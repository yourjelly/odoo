# -*- coding: utf-8 -*-
from collections import defaultdict
from contextlib import ExitStack, contextmanager
from datetime import date, timedelta

from dateutil.relativedelta import relativedelta
from hashlib import sha256
from json import dumps
import logging
from markupsafe import Markup
import ast
import math
import psycopg2
import re
from textwrap import shorten

from odoo import api, fields, models, _, Command
from odoo.addons.account.tools import format_structured_reference_iso
from odoo.exceptions import UserError, ValidationError, AccessError, RedirectWarning
from odoo.osv import expression
from odoo.tools import (
    create_index,
    date_utils,
    float_compare,
    float_is_zero,
    float_repr,
    float_round,
    format_amount,
    format_date,
    formatLang,
    frozendict,
    get_lang,
    groupby,
    index_exists,
    OrderedSet,
    SQL,
)
from odoo.tools.mail import email_re, email_split, is_html_empty


_logger = logging.getLogger(__name__)


MAX_HASH_VERSION = 4

PAYMENT_STATE_SELECTION = [
        ('not_paid', 'Not Paid'),
        ('in_payment', 'In Payment'),
        ('paid', 'Paid'),
        ('partial', 'Partially Paid'),
        ('reversed', 'Reversed'),
        ('invoicing_legacy', 'Invoicing App Legacy'),
]

TYPE_REVERSE_MAP = {
    'entry': 'entry',
    'out_invoice': 'out_refund',
    'out_refund': 'entry',
    'in_invoice': 'in_refund',
    'in_refund': 'entry',
    'out_receipt': 'out_refund',
    'in_receipt': 'in_refund',
}

EMPTY = object()


class AccountMove(models.Model):
    _name = "account.move"
    _inherit = ['portal.mixin', 'mail.thread.main.attachment', 'mail.activity.mixin', 'sequence.mixin', 'product.catalog.mixin']
    _description = "Journal Entry"
    _order = 'date desc, name desc, invoice_date desc, id desc'
    _mail_post_access = 'read'
    _check_company_auto = True
    _sequence_index = "journal_id"
    _rec_names_search = ['name', 'partner_id.name', 'ref']
    _systray_view = 'activity'
    _mailing_enabled = True

    @property
    def _sequence_monthly_regex(self):
        return self.journal_id.sequence_override_regex or super()._sequence_monthly_regex

    @property
    def _sequence_yearly_regex(self):
        return self.journal_id.sequence_override_regex or super()._sequence_yearly_regex

    @property
    def _sequence_fixed_regex(self):
        return self.journal_id.sequence_override_regex or super()._sequence_fixed_regex


    # ==============================================================================================
    #                                          JOURNAL ENTRY
    # ==============================================================================================

    # === Accounting fields === #
    name = fields.Char(
        string='Number',
        compute='_compute_name', inverse='_inverse_name', readonly=False, store=True,
        copy=False,
        tracking=True,
        index='trigram',
    )
    ref = fields.Char(
        string='Reference',
        copy=False,
        tracking=True,
        index='trigram',
    )
    date = fields.Date(
        string='Date',
        index=True,
        compute='_compute_date', store=True, required=True, readonly=False, precompute=True,
        copy=False,
        tracking=True,
    )
    state = fields.Selection(
        selection=[
            ('draft', 'Draft'),
            ('posted', 'Posted'),
            ('cancel', 'Cancelled'),
        ],
        string='Status',
        required=True,
        readonly=True,
        copy=False,
        tracking=True,
        default='draft',
    )
    move_type = fields.Selection(
        selection=[
            ('entry', 'Journal Entry'),
            ('out_invoice', 'Customer Invoice'),
            ('out_refund', 'Customer Credit Note'),
            ('in_invoice', 'Vendor Bill'),
            ('in_refund', 'Vendor Credit Note'),
            ('out_receipt', 'Sales Receipt'),
            ('in_receipt', 'Purchase Receipt'),
        ],
        string='Type',
        required=True,
        readonly=True,
        tracking=True,
        change_default=True,
        index=True,
        default="entry",
    )
    is_storno = fields.Boolean(
        compute='_compute_is_storno', store=True, readonly=False,
        copy=False,
    )
    journal_id = fields.Many2one(
        'account.journal',
        string='Journal',
        compute='_compute_journal_id', inverse='_inverse_journal_id', store=True, readonly=False, precompute=True,
        required=True,
        check_company=True,
        domain="[('id', 'in', suitable_journal_ids)]",
    )
    company_id = fields.Many2one(
        comodel_name='res.company',
        string='Company',
        compute='_compute_company_id', inverse='_inverse_company_id', store=True, readonly=False, precompute=True,
        index=True,
    )
    line_ids = fields.One2many(
        'account.move.line',
        'move_id',
        string='Journal Items',
        copy=True,
    )

    # === Payment fields === #
    payment_id = fields.Many2one(
        comodel_name='account.payment',
        string="Payment",
        index='btree_not_null',
        copy=False,
        check_company=True,
    )

    # === Statement fields === #
    statement_line_id = fields.Many2one(
        comodel_name='account.bank.statement.line',
        string="Statement Line",
        copy=False,
        check_company=True,
        index='btree_not_null',
    )
    statement_id = fields.Many2one(
        related="statement_line_id.statement_id"
    )

    # === Cash basis feature fields === #
    # used to keep track of the tax cash basis reconciliation. This is needed
    # when cancelling the source: it will post the inverse journal entry to
    # cancel that part too.
    tax_cash_basis_rec_id = fields.Many2one(
        comodel_name='account.partial.reconcile',
        index='btree_not_null',
        string='Tax Cash Basis Entry of',
    )
    tax_cash_basis_origin_move_id = fields.Many2one(
        comodel_name='account.move',
        index='btree_not_null',
        string="Cash Basis Origin",
        readonly=True,
        help="The journal entry from which this tax cash basis journal entry has been created.",
    )
    tax_cash_basis_created_move_ids = fields.One2many(
        string="Cash Basis Entries",
        comodel_name='account.move',
        inverse_name='tax_cash_basis_origin_move_id',
        help="The cash basis entries created from the taxes on this entry, when reconciling its lines.",
    )

    # used by cash basis taxes, telling the lines of the move are always
    # exigible. This happens if the move contains no payable or receivable line.
    always_tax_exigible = fields.Boolean(compute='_compute_always_tax_exigible', store=True, readonly=False)

    # === Misc fields === #
    auto_post = fields.Selection(
        string='Auto-post',
        selection=[
            ('no', 'No'),
            ('at_date', 'At Date'),
            ('monthly', 'Monthly'),
            ('quarterly', 'Quarterly'),
            ('yearly', 'Yearly'),
        ],
        default='no', required=True, copy=False,
        help='Specify whether this entry is posted automatically on its accounting date, and any similar recurring invoices.')
    auto_post_until = fields.Date(
        string='Auto-post until',
        copy=False,
        compute='_compute_auto_post_until', store=True, readonly=False,
        help='This recurring move will be posted up to and including this date.')
    auto_post_origin_id = fields.Many2one(
        comodel_name='account.move',
        string='First recurring entry',
        readonly=True, copy=False,
        index='btree_not_null',
    )
    hide_post_button = fields.Boolean(compute='_compute_hide_post_button', readonly=True)
    to_check = fields.Boolean(
        string='To Check',
        tracking=True,
        help="If this checkbox is ticked, it means that the user was not sure of all the related "
             "information at the time of the creation of the move and that the move needs to be "
             "checked again.",
    )
    posted_before = fields.Boolean(copy=False)
    suitable_journal_ids = fields.Many2many(
        'account.journal',
        compute='_compute_suitable_journal_ids',
    )
    highest_name = fields.Char(compute='_compute_highest_name')
    made_sequence_gap = fields.Boolean(compute='_compute_made_sequence_gap', store=True)  # store wether this is the first move breaking the natural sequencing
    show_name_warning = fields.Boolean(store=False)
    type_name = fields.Char('Type Name', compute='_compute_type_name')
    country_code = fields.Char(related='company_id.account_fiscal_country_id.code', readonly=True)
    attachment_ids = fields.One2many('ir.attachment', 'res_id', domain=[('res_model', '=', 'account.move')], string='Attachments')

    # === Hash Fields === #
    restrict_mode_hash_table = fields.Boolean(related='journal_id.restrict_mode_hash_table')
    secure_sequence_number = fields.Integer(string="Inalterability No Gap Sequence #", readonly=True, copy=False, index=True)
    inalterable_hash = fields.Char(string="Inalterability Hash", readonly=True, copy=False, index='btree_not_null')

    # ==============================================================================================
    #                                          INVOICE
    # ==============================================================================================

    invoice_line_ids = fields.One2many(  # /!\ invoice_line_ids is just a subset of line_ids.
        'account.move.line',
        'move_id',
        string='Invoice lines',
        copy=False,
        domain=[('display_type', 'in', ('product', 'line_section', 'line_note'))],
    )

    # === Date fields === #
    invoice_date = fields.Date(
        string='Invoice/Bill Date',
        index=True,
        copy=False,
    )
    invoice_date_due = fields.Date(
        string='Due Date',
        index=True,
        copy=False,
    )
    delivery_date = fields.Date(
        string='Delivery Date',
        copy=False,
        store=True,
        compute='_compute_delivery_date',
    )
    show_delivery_date = fields.Boolean(compute='_compute_show_delivery_date')
    invoice_payment_term_id = fields.Many2one(
        comodel_name='account.payment.term',
        string='Payment Terms',
        compute='_compute_invoice_payment_term_id',
        store=True,
        readonly=False,
        precompute=True,
        check_company=True,
    )
    tax_calculation_rounding_method = fields.Selection(
        related='company_id.tax_calculation_rounding_method',
        string='Tax calculation rounding method', readonly=True)
    # === Partner fields === #
    partner_id = fields.Many2one(
        comodel_name='res.partner',
        string='Partner',
        readonly=False,
        tracking=True,
        check_company=True,
        change_default=True,
        index=True,
        ondelete='restrict',
    )
    commercial_partner_id = fields.Many2one(
        'res.partner',
        string='Commercial Entity',
        compute='_compute_commercial_partner_id', store=True, readonly=True,
        ondelete='restrict',
        check_company=True,
    )
    partner_shipping_id = fields.Many2one(
        comodel_name='res.partner',
        string='Delivery Address',
        compute='_compute_partner_shipping_id', store=True, readonly=False, precompute=True,
        check_company=True,
        help="The delivery address will be used in the computation of the fiscal position.",
    )
    partner_bank_id = fields.Many2one(
        'res.partner.bank',
        string='Recipient Bank',
        compute='_compute_partner_bank_id', store=True, readonly=False,
        help="Bank Account Number to which the invoice will be paid. "
             "A Company bank account if this is a Customer Invoice or Vendor Credit Note, "
             "otherwise a Partner bank account number.",
        check_company=True,
        tracking=True,
        ondelete='restrict',
    )
    fiscal_position_id = fields.Many2one(
        'account.fiscal.position',
        string='Fiscal Position',
        check_company=True,
        compute='_compute_fiscal_position_id', store=True, readonly=False, precompute=True,
        ondelete="restrict",
        help="Fiscal positions are used to adapt taxes and accounts for particular "
             "customers or sales orders/invoices. The default value comes from the customer.",
    )

    # === Payment fields === #
    payment_reference = fields.Char(
        string='Payment Reference',
        index='trigram',
        copy=False,
        help="The payment reference to set on journal items.",
        tracking=True,
        compute='_compute_payment_reference',
        store=True,
        readonly=False,
    )
    display_qr_code = fields.Boolean(
        string="Display QR-code",
        compute='_compute_display_qr_code',
    )
    qr_code_method = fields.Selection(
        string="Payment QR-code", copy=False,
        selection=lambda self: self.env['res.partner.bank'].get_available_qr_methods_in_sequence(),
        help="Type of QR-code to be generated for the payment of this invoice, "
             "when printing it. If left blank, the first available and usable method "
             "will be used.",
    )

    # === Payment widget fields === #
    invoice_outstanding_credits_debits_widget = fields.Binary(
        groups="account.group_account_invoice,account.group_account_readonly",
        compute='_compute_payments_widget_to_reconcile_info',
        exportable=False,
    )
    invoice_has_outstanding = fields.Boolean(
        groups="account.group_account_invoice,account.group_account_readonly",
        compute='_compute_payments_widget_to_reconcile_info',
    )
    invoice_payments_widget = fields.Binary(
        groups="account.group_account_invoice,account.group_account_readonly",
        compute='_compute_payments_widget_reconciled_info',
        exportable=False,
    )

    # === Currency fields === #
    company_currency_id = fields.Many2one(
        string='Company Currency',
        related='company_id.currency_id', readonly=True,
    )
    currency_id = fields.Many2one(
        'res.currency',
        string='Currency',
        tracking=True,
        required=True,
        compute='_compute_currency_id', store=True, readonly=False, precompute=True,
    )
    invoice_currency_rate = fields.Float(
        string='Currency Rate',
        compute='_compute_invoice_currency_rate', store=True, precompute=True,
        copy=False,
        digits=0,
        help="Currency rate from company currency to document currency.",
    )
    is_multi_currency = fields.Boolean(compute='_compute_is_multi_currency')

    # === Amount fields === #
    direction_sign = fields.Integer(
        compute='_compute_direction_sign',
        help="Multiplicator depending on the document type, to convert a price into a balance",
    )
    amount_untaxed = fields.Monetary(
        string='Untaxed Amount',
        compute='_compute_amount', store=True, readonly=True,
        tracking=True,
    )
    amount_tax = fields.Monetary(
        string='Tax',
        compute='_compute_amount', store=True, readonly=True,
    )
    amount_total = fields.Monetary(
        string='Total',
        compute='_compute_amount', store=True, readonly=True,
        inverse='_inverse_amount_total',
    )
    amount_residual = fields.Monetary(
        string='Amount Due',
        compute='_compute_amount', store=True,
    )
    amount_untaxed_signed = fields.Monetary(
        string='Untaxed Amount Signed',
        compute='_compute_amount', store=True, readonly=True,
        currency_field='company_currency_id',
    )
    amount_tax_signed = fields.Monetary(
        string='Tax Signed',
        compute='_compute_amount', store=True, readonly=True,
        currency_field='company_currency_id',
    )
    amount_total_signed = fields.Monetary(
        string='Total Signed',
        compute='_compute_amount', store=True, readonly=True,
        currency_field='company_currency_id',
    )
    amount_total_in_currency_signed = fields.Monetary(
        string='Total in Currency Signed',
        compute='_compute_amount', store=True, readonly=True,
        currency_field='currency_id',
    )
    amount_residual_signed = fields.Monetary(
        string='Amount Due Signed',
        compute='_compute_amount', store=True,
        currency_field='company_currency_id',
    )
    tax_totals = fields.Binary(
        string="Invoice Totals",
        compute='_compute_tax_totals',
        help='Edit Tax amounts if you encounter rounding issues.',
        exportable=False,
    )
    payment_state = fields.Selection(
        selection=PAYMENT_STATE_SELECTION,
        string="Payment Status",
        compute='_compute_payment_state', store=True, readonly=True,
        copy=False,
        tracking=True,
    )
    amount_total_words = fields.Char(
        string="Amount total in words",
        compute="_compute_amount_total_words",
    )

    # === Reverse feature fields === #
    reversed_entry_id = fields.Many2one(
        comodel_name='account.move',
        string="Reversal of",
        index='btree_not_null',
        readonly=True,
        copy=False,
        check_company=True,
    )
    reversal_move_ids = fields.One2many('account.move', 'reversed_entry_id')

    # === Vendor bill fields === #
    invoice_vendor_bill_id = fields.Many2one(
        'account.move',
        store=False,
        check_company=True,
        string='Vendor Bill',
        help="Auto-complete from a past bill.",
    )
    invoice_source_email = fields.Char(string='Source Email', tracking=True)
    invoice_partner_display_name = fields.Char(compute='_compute_invoice_partner_display_info', store=True)

    # === Fiduciary mode fields === #
    quick_edit_mode = fields.Boolean(compute='_compute_quick_edit_mode')
    quick_edit_total_amount = fields.Monetary(
        string='Total (Tax inc.)',
        help='Use this field to encode the total amount of the invoice.\n'
             'Odoo will automatically create one invoice line with default values to match it.',
    )
    quick_encoding_vals = fields.Binary(compute='_compute_quick_encoding_vals', exportable=False)

    # === Misc Information === #
    narration = fields.Html(
        string='Terms and Conditions',
        compute='_compute_narration', store=True, readonly=False,
    )
    is_move_sent = fields.Boolean(
        readonly=True,
        copy=False,
        tracking=True,
        help="It indicates that the invoice/payment has been sent or the PDF has been generated.",
    )
    is_being_sent = fields.Boolean(
        help="Is the move being sent asynchronously",
        compute='_compute_is_being_sent'
    )

    move_sent_values = fields.Selection(
        selection=[
            ('sent', 'Sent'),
            ('not_sent', 'Not Sent'),
        ],
        string='Sent',
        compute='compute_move_sent_values',
    )
    invoice_user_id = fields.Many2one(
        string='Salesperson',
        comodel_name='res.users',
        copy=False,
        tracking=True,
        compute='_compute_invoice_default_sale_person',
        store=True,
        readonly=False,
    )
    # Technical field used to fit the generic behavior in mail templates.
    user_id = fields.Many2one(string='User', related='invoice_user_id')
    invoice_origin = fields.Char(
        string='Origin',
        readonly=True,
        tracking=True,
        help="The document(s) that generated the invoice.",
    )
    invoice_incoterm_id = fields.Many2one(
        comodel_name='account.incoterms',
        string='Incoterm',
        default=lambda self: self.env.company.incoterm_id,
        help='International Commercial Terms are a series of predefined commercial '
             'terms used in international transactions.',
    )
    incoterm_location = fields.Char(
        string='Incoterm Location',
        compute='_compute_incoterm_location',
        readonly=False,
        store=True,
    )
    invoice_cash_rounding_id = fields.Many2one(
        comodel_name='account.cash.rounding',
        string='Cash Rounding Method',
        help='Defines the smallest coinage of the currency that can be used to pay by cash.',
    )
    send_and_print_values = fields.Json(copy=False)
    invoice_pdf_report_id = fields.Many2one(
        comodel_name='ir.attachment',
        string="PDF Attachment",
        compute=lambda self: self._compute_linked_attachment_id('invoice_pdf_report_id', 'invoice_pdf_report_file'),
        depends=['invoice_pdf_report_file']
    )
    invoice_pdf_report_file = fields.Binary(
        attachment=True,
        string="PDF File",
        copy=False,
    )

    # === Display purpose fields === #
    # used to have a dynamic domain on journal / taxes in the form view.
    invoice_filter_type_domain = fields.Char(compute='_compute_invoice_filter_type_domain')
    bank_partner_id = fields.Many2one(
        comodel_name='res.partner',
        compute='_compute_bank_partner_id',
        help='Technical field to get the domain on the bank',
    )
    # used to display a message when the invoice's accounting date is prior of the tax lock date
    tax_lock_date_message = fields.Char(compute='_compute_tax_lock_date_message')
    # used for tracking the status of the currency
    display_inactive_currency_warning = fields.Boolean(compute="_compute_display_inactive_currency_warning")
    tax_country_id = fields.Many2one(  # used to filter the available taxes depending on the fiscal country and fiscal position.
        comodel_name='res.country',
        compute='_compute_tax_country_id',
    )
    tax_country_code = fields.Char(compute="_compute_tax_country_code")
    has_reconciled_entries = fields.Boolean(compute="_compute_has_reconciled_entries")
    show_reset_to_draft_button = fields.Boolean(compute='_compute_show_reset_to_draft_button')
    partner_credit_warning = fields.Text(
        compute='_compute_partner_credit_warning',
        groups="account.group_account_invoice,account.group_account_readonly",
    )
    partner_credit = fields.Monetary(compute='_compute_partner_credit')
    duplicated_ref_ids = fields.Many2many(comodel_name='account.move', compute='_compute_duplicated_ref_ids')
    need_cancel_request = fields.Boolean(compute='_compute_need_cancel_request')

    show_update_fpos = fields.Boolean(string="Has Fiscal Position Changed", store=False)  # True if the fiscal position was changed

    # used to display the various dates and amount dues on the invoice's PDF
    payment_term_details = fields.Binary(compute="_compute_payment_term_details", exportable=False)
    show_payment_term_details = fields.Boolean(compute="_compute_show_payment_term_details")
    show_discount_details = fields.Boolean(compute="_compute_show_payment_term_details")

    abnormal_amount_warning = fields.Text(compute='_compute_abnormal_warnings')
    abnormal_date_warning = fields.Text(compute='_compute_abnormal_warnings')

    taxes_legal_notes = fields.Html(string='Taxes Legal Notes', compute='_compute_taxes_legal_notes')

    invoice_line_ids_mode = fields.Boolean(store=False)

    _sql_constraints = [(
        'unique_name', "", "Another entry with the same name already exists.",
    )]

    def _auto_init(self):
        super()._auto_init()
        if not index_exists(self.env.cr, 'account_move_to_check_idx'):
            self.env.cr.execute("""
                CREATE INDEX account_move_to_check_idx
                          ON account_move(journal_id)
                       WHERE to_check = true
            """)
        if not index_exists(self.env.cr, 'account_move_payment_idx'):
            self.env.cr.execute("""
                CREATE INDEX account_move_payment_idx
                          ON account_move(journal_id, state, payment_state, move_type, date)
            """)
        if not index_exists(self.env.cr, 'account_move_unique_name'):
            self.env.cr.execute("""
                CREATE UNIQUE INDEX account_move_unique_name
                                 ON account_move(name, journal_id)
                              WHERE (state = 'posted' AND name != '/')
            """)

    def init(self):
        super().init()
        create_index(self.env.cr,
                     indexname='account_move_journal_id_company_id_idx',
                     tablename='account_move',
                     expressions=['journal_id', 'company_id', 'date'])
        create_index(
            self.env.cr,
            indexname='account_move_made_gaps',
            tablename='account_move',
            expressions=['journal_id', 'company_id', 'date'],
            where="made_sequence_gap = TRUE",
        )  # used in <account.journal>._query_has_sequence_holes

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('move_type')
    def _compute_invoice_default_sale_person(self):
        # We want to modify the sale person only when we don't have one and if the move type corresponds to this condition
        # If the move doesn't correspond, we remove the sale person
        for move in self:
            if move.is_sale_document(include_receipts=True):
                move.invoice_user_id = move.invoice_user_id or self.env.user
            else:
                move.invoice_user_id = False

    def _compute_is_being_sent(self):
        for move in self:
            move.is_being_sent = bool(move.send_and_print_values)

    @api.depends('is_move_sent')
    def compute_move_sent_values(self):
        for move in self:
            move.move_sent_values = 'sent' if move.is_move_sent else 'not_sent'

    @api.depends('state')
    def _compute_payment_reference(self):
        for move in self.filtered(lambda m: (
            m.state == 'posted'
            and m.move_type == 'out_invoice'
            and not m.payment_reference
        )):
            move.payment_reference = move._get_invoice_computed_reference()

    @api.depends('invoice_date', 'company_id')
    def _compute_date(self):
        for move in self:
            if not move.invoice_date:
                if not move.date:
                    move.date = fields.Date.context_today(self)
                continue
            accounting_date = move.invoice_date
            if not move.is_sale_document(include_receipts=True):
                accounting_date = move._get_accounting_date(move.invoice_date, move._affect_tax_report())
            if accounting_date and accounting_date != move.date:
                move.date = accounting_date
                # _affect_tax_report may trigger premature recompute of line_ids.date
                self.env.add_to_compute(move.line_ids._fields['date'], move.line_ids)
                # might be protected because `_get_accounting_date` requires the `name`
                self.env.add_to_compute(self._fields['name'], move)

    @api.depends('auto_post')
    def _compute_auto_post_until(self):
        for record in self:
            if record.auto_post in ('no', 'at_date'):
                record.auto_post_until = False

    @api.depends('date', 'auto_post')
    def _compute_hide_post_button(self):
        for record in self:
            record.hide_post_button = record.state != 'draft' \
                or record.auto_post != 'no' and record.date > fields.Date.context_today(record)

    @api.depends('journal_id')
    def _compute_company_id(self):
        for move in self:
            if move.journal_id.company_id not in move.company_id.parent_ids:
                move.company_id = (move.journal_id.company_id or self.env.company)._accessible_branches()[:1]

    @api.depends('move_type', 'payment_id', 'statement_line_id')
    def _compute_journal_id(self):
        for move in self.filtered(lambda r: r.journal_id.type not in r._get_valid_journal_types()):
            move.journal_id = move._search_default_journal()

    def _get_valid_journal_types(self):
        if self.is_sale_document(include_receipts=True):
            return ['sale']
        elif self.is_purchase_document(include_receipts=True):
            return ['purchase']
        elif self.payment_id or self.statement_line_id or self.env.context.get('is_payment') or self.env.context.get('is_statement_line'):
            return ['bank', 'cash']
        return ['general']

    def _search_default_journal(self):
        if self.statement_line_ids.statement_id.journal_id:
            return self.statement_line_ids.statement_id.journal_id[:1]

        journal_types = self._get_valid_journal_types()
        company = self.company_id or self.env.company
        domain = [
            *self.env['account.journal']._check_company_domain(company),
            ('type', 'in', journal_types),
        ]

        journal = None
        # the currency is not a hard dependence, it triggers via manual add_to_compute
        # avoid computing the currency before all it's dependences are set (like the journal...)
        if self.env.cache.contains(self, self._fields['currency_id']):
            currency_id = self.currency_id.id or self._context.get('default_currency_id')
            if currency_id and currency_id != company.currency_id.id:
                currency_domain = domain + [('currency_id', '=', currency_id)]
                journal = self.env['account.journal'].search(currency_domain, limit=1)

        if not journal:
            journal = self.env['account.journal'].search(domain, limit=1)

        if not journal:
            error_msg = _(
                "No journal could be found in company %(company_name)s for any of those types: %(journal_types)s",
                company_name=company.display_name,
                journal_types=', '.join(journal_types),
            )
            raise UserError(error_msg)

        return journal

    @api.depends('move_type')
    def _compute_is_storno(self):
        for move in self:
            move.is_storno = move.is_storno or (move.move_type in ('out_refund', 'in_refund') and move.company_id.account_storno)

    @api.depends('company_id', 'invoice_filter_type_domain')
    def _compute_suitable_journal_ids(self):
        for m in self:
            journal_type = m.invoice_filter_type_domain or 'general'
            company = m.company_id or self.env.company
            m.suitable_journal_ids = self.env['account.journal'].search([
                *self.env['account.journal']._check_company_domain(company),
                ('type', '=', journal_type),
            ])

    @api.depends('posted_before', 'state', 'journal_id', 'date', 'move_type', 'payment_id')
    def _compute_name(self):
        self = self.sorted(lambda m: (m.date, m.ref or '', m._origin.id))

        for move in self:
            if move.state == 'cancel':
                continue

            move_has_name = move.name and move.name != '/'
            if move_has_name or move.state != 'posted':
                if not move.posted_before and not move._sequence_matches_date():
                    if move._get_last_sequence():
                        # The name does not match the date and the move is not the first in the period:
                        # Reset to draft
                        move.name = False
                        continue
                else:
                    if move_has_name and move.posted_before or not move_has_name and move._get_last_sequence():
                        # The move either
                        # - has a name and was posted before, or
                        # - doesn't have a name, but is not the first in the period
                        # so we don't recompute the name
                        continue
            if move.date and (not move_has_name or not move._sequence_matches_date()):
                move._set_next_sequence()

        self.filtered(lambda m: not m.name and not move.quick_edit_mode).name = '/'
        self._inverse_name()

    @api.depends('journal_id', 'date')
    def _compute_highest_name(self):
        for record in self:
            record.highest_name = record._get_last_sequence()

    @api.depends('journal_id', 'sequence_number', 'sequence_prefix', 'state')
    def _compute_made_sequence_gap(self):
        unposted = self.filtered(lambda move: move.sequence_number != 0 and move.state != 'posted')
        unposted.made_sequence_gap = True
        for (journal, prefix), moves in (self - unposted).grouped(lambda m: (m.journal_id, m.sequence_prefix)).items():
            previous_numbers = set(self.env['account.move'].sudo().search([
                ('journal_id', '=', journal.id),
                ('sequence_prefix', '=', prefix),
                ('sequence_number', '>=', min(moves.mapped('sequence_number')) - 1),
                ('sequence_number', '<=', max(moves.mapped('sequence_number')) - 1),
            ]).mapped('sequence_number'))
            for move in moves:
                move.made_sequence_gap = move.sequence_number > 1 and (move.sequence_number - 1) not in previous_numbers

    @api.depends('move_type')
    def _compute_type_name(self):
        type_name_mapping = dict(
            self._fields['move_type']._description_selection(self.env),
            out_invoice=_('Invoice'),
            out_refund=_('Credit Note'),
        )

        for record in self:
            record.type_name = type_name_mapping[record.move_type]

    @api.depends('line_ids.account_id.account_type')
    def _compute_always_tax_exigible(self):
        for record in self.with_context(prefetch_fields=False):
            # We need to check is_invoice as well because always_tax_exigible is used to
            # set the tags as well, during the encoding. So, if no receivable/payable
            # line has been created yet, the invoice would be detected as always exigible,
            # and set the tags on some lines ; which would be wrong.
            record.always_tax_exigible = not record.is_invoice(True) \
                                         and not record._collect_tax_cash_basis_values()

    @api.depends('partner_id')
    def _compute_commercial_partner_id(self):
        for move in self:
            move.commercial_partner_id = move.partner_id.commercial_partner_id

    @api.depends('partner_id')
    def _compute_partner_shipping_id(self):
        for move in self:
            if move.is_invoice(include_receipts=True):
                addr = move.partner_id.address_get(['delivery'])
                move.partner_shipping_id = addr and addr.get('delivery')
            else:
                move.partner_shipping_id = False

    @api.depends('partner_id', 'partner_shipping_id', 'company_id')
    def _compute_fiscal_position_id(self):
        for move in self:
            delivery_partner = self.env['res.partner'].browse(
                move.partner_shipping_id.id
                or move.partner_id.address_get(['delivery'])['delivery']
            )
            move.fiscal_position_id = self.env['account.fiscal.position'].with_company(move.company_id)._get_fiscal_position(
                move.partner_id, delivery=delivery_partner)

    @api.depends('bank_partner_id')
    def _compute_partner_bank_id(self):
        for move in self:
            bank_ids = move.bank_partner_id.bank_ids.filtered(
                lambda bank: not bank.company_id or bank.company_id == move.company_id)
            move.partner_bank_id = bank_ids[0] if bank_ids else False

    @api.depends('partner_id')
    def _compute_invoice_payment_term_id(self):
        for move in self:
            if move.is_sale_document(include_receipts=True) and move.partner_id.property_payment_term_id:
                move.invoice_payment_term_id = move.partner_id.property_payment_term_id
            elif move.is_purchase_document(include_receipts=True) and move.partner_id.property_supplier_payment_term_id:
                move.invoice_payment_term_id = move.partner_id.property_supplier_payment_term_id
            else:
                move.invoice_payment_term_id = False

    def _compute_delivery_date(self):
        pass

    @api.depends('delivery_date')
    def _compute_show_delivery_date(self):
        for move in self:
            move.show_delivery_date = move.delivery_date and move.is_sale_document()

    @api.depends('journal_id', 'statement_line_id')
    def _compute_currency_id(self):
        for invoice in self:
            currency = (
                invoice.statement_line_id.foreign_currency_id
                or invoice.journal_id.currency_id
                or invoice.currency_id
                or invoice.journal_id.company_id.currency_id
            )
            invoice.currency_id = currency

    @api.depends('currency_id', 'company_currency_id', 'company_id', 'invoice_date')
    def _compute_invoice_currency_rate(self):
        for move in self:
            if move.is_invoice(include_receipts=True):
                if move.currency_id:
                    move.invoice_currency_rate = self.env['res.currency']._get_conversion_rate(
                        from_currency=move.company_currency_id,
                        to_currency=move.currency_id,
                        company=move.company_id,
                        date=move.invoice_date or fields.Date.context_today(move),
                    )
                else:
                    move.invoice_currency_rate = 1

    def _compute_is_multi_currency(self):
        self.is_multi_currency = self.env.user.has_groups('base.group_multi_currency')

    @api.depends('move_type')
    def _compute_direction_sign(self):
        for invoice in self:
            if invoice.move_type == 'entry' or invoice.is_outbound():
                invoice.direction_sign = 1
            else:
                invoice.direction_sign = -1

    @api.depends(
        'line_ids.matched_debit_ids.debit_move_id.move_id.payment_id.is_matched',
        'line_ids.matched_debit_ids.debit_move_id.move_id.line_ids.amount_residual',
        'line_ids.matched_debit_ids.debit_move_id.move_id.line_ids.amount_residual_currency',
        'line_ids.matched_credit_ids.credit_move_id.move_id.payment_id.is_matched',
        'line_ids.matched_credit_ids.credit_move_id.move_id.line_ids.amount_residual',
        'line_ids.matched_credit_ids.credit_move_id.move_id.line_ids.amount_residual_currency',
        'line_ids.balance',
        'line_ids.currency_id',
        'line_ids.amount_currency',
        'line_ids.amount_residual',
        'line_ids.amount_residual_currency',
        'line_ids.payment_id.state',
        'line_ids.full_reconcile_id',
        'state')
    def _compute_amount(self):
        for move in self:
            total_untaxed, total_untaxed_currency = 0.0, 0.0
            total_tax, total_tax_currency = 0.0, 0.0
            total_residual, total_residual_currency = 0.0, 0.0
            total, total_currency = 0.0, 0.0

            for line in move.line_ids:
                if move.is_invoice(True):
                    # === Invoices ===
                    if line.display_type == 'tax' or (line.display_type == 'rounding' and line.tax_repartition_line_id):
                        # Tax amount.
                        total_tax += line.balance
                        total_tax_currency += line.amount_currency
                        total += line.balance
                        total_currency += line.amount_currency
                    elif line.display_type in ('product', 'rounding'):
                        # Untaxed amount.
                        total_untaxed += line.balance
                        total_untaxed_currency += line.amount_currency
                        total += line.balance
                        total_currency += line.amount_currency
                    elif line.display_type == 'payment_term':
                        # Residual amount.
                        total_residual += line.amount_residual
                        total_residual_currency += line.amount_residual_currency
                else:
                    # === Miscellaneous journal entry ===
                    if line.debit:
                        total += line.balance
                        total_currency += line.amount_currency

            sign = move.direction_sign
            move.amount_untaxed = sign * total_untaxed_currency
            move.amount_tax = sign * total_tax_currency
            move.amount_total = sign * total_currency
            move.amount_residual = -sign * total_residual_currency
            move.amount_untaxed_signed = -total_untaxed
            move.amount_tax_signed = -total_tax
            move.amount_total_signed = abs(total) if move.move_type == 'entry' else -total
            move.amount_residual_signed = total_residual
            move.amount_total_in_currency_signed = abs(move.amount_total) if move.move_type == 'entry' else -(sign * move.amount_total)

    @api.depends('amount_residual', 'move_type', 'state', 'company_id')
    def _compute_payment_state(self):
        stored_ids = tuple(self.ids)
        if stored_ids:
            self.env['account.partial.reconcile'].flush_model()
            self.env['account.payment'].flush_model(['is_matched'])

            queries = []
            for source_field, counterpart_field in (
                ('debit_move_id', 'credit_move_id'),
                ('credit_move_id', 'debit_move_id'),
            ):
                queries.append(SQL('''
                    SELECT
                        source_line.id AS source_line_id,
                        source_line.move_id AS source_move_id,
                        account.account_type AS source_line_account_type,
                        ARRAY_AGG(counterpart_move.move_type) AS counterpart_move_types,
                        COALESCE(BOOL_AND(COALESCE(pay.is_matched, FALSE))
                            FILTER (WHERE counterpart_move.payment_id IS NOT NULL), TRUE) AS all_payments_matched,
                        BOOL_OR(COALESCE(BOOL(pay.id), FALSE)) as has_payment,
                        BOOL_OR(COALESCE(BOOL(counterpart_move.statement_line_id), FALSE)) as has_st_line
                    FROM account_partial_reconcile part
                    JOIN account_move_line source_line ON source_line.id = part.%s
                    JOIN account_account account ON account.id = source_line.account_id
                    JOIN account_move_line counterpart_line ON counterpart_line.id = part.%s
                    JOIN account_move counterpart_move ON counterpart_move.id = counterpart_line.move_id
                    LEFT JOIN account_payment pay ON pay.id = counterpart_move.payment_id
                    WHERE source_line.move_id IN %s AND counterpart_line.move_id != source_line.move_id
                    GROUP BY source_line_id, source_move_id, source_line_account_type
                ''', SQL.identifier(source_field), SQL.identifier(counterpart_field), stored_ids))

            payment_data = defaultdict(list)
            for row in self.env.execute_query_dict(SQL(" UNION ALL ").join(queries)):
                payment_data[row['source_move_id']].append(row)
        else:
            payment_data = {}

        for invoice in self:
            if invoice.payment_state == 'invoicing_legacy':
                # invoicing_legacy state is set via SQL when setting setting field
                # invoicing_switch_threshold (defined in account_accountant).
                # The only way of going out of this state is through this setting,
                # so we don't recompute it here.
                continue

            currencies = invoice._get_lines_onchange_currency().currency_id
            currency = currencies if len(currencies) == 1 else invoice.company_id.currency_id
            reconciliation_vals = payment_data.get(invoice.id, [])
            payment_state_matters = invoice.is_invoice(True)

            # Restrict on 'receivable'/'payable' lines for invoices/expense entries.
            if payment_state_matters:
                reconciliation_vals = [x for x in reconciliation_vals if x['source_line_account_type'] in ('asset_receivable', 'liability_payable')]

            new_pmt_state = 'not_paid'
            if invoice.state == 'posted':

                # Posted invoice/expense entry.
                if payment_state_matters:

                    if currency.is_zero(invoice.amount_residual):
                        if any(x['has_payment'] or x['has_st_line'] for x in reconciliation_vals):

                            # Check if the invoice/expense entry is fully paid or 'in_payment'.
                            if all(x['all_payments_matched'] for x in reconciliation_vals):
                                new_pmt_state = 'paid'
                            else:
                                new_pmt_state = invoice._get_invoice_in_payment_state()

                        else:
                            new_pmt_state = 'paid'

                            reverse_move_types = set()
                            for x in reconciliation_vals:
                                for move_type in x['counterpart_move_types']:
                                    reverse_move_types.add(move_type)

                            in_reverse = (invoice.move_type in ('in_invoice', 'in_receipt')
                                          and (reverse_move_types == {'in_refund'} or reverse_move_types == {'in_refund', 'entry'}))
                            out_reverse = (invoice.move_type in ('out_invoice', 'out_receipt')
                                           and (reverse_move_types == {'out_refund'} or reverse_move_types == {'out_refund', 'entry'}))
                            misc_reverse = (invoice.move_type in ('entry', 'out_refund', 'in_refund')
                                            and reverse_move_types == {'entry'})
                            if in_reverse or out_reverse or misc_reverse:
                                new_pmt_state = 'reversed'

                    elif reconciliation_vals:
                        new_pmt_state = 'partial'

            invoice.payment_state = new_pmt_state

    def _compute_payments_widget_to_reconcile_info(self):
        for move in self:
            move.invoice_outstanding_credits_debits_widget = False
            move.invoice_has_outstanding = False

            if move.state != 'posted' \
                    or move.payment_state not in ('not_paid', 'partial') \
                    or not move.is_invoice(include_receipts=True):
                continue

            pay_term_lines = move.line_ids\
                .filtered(lambda line: line.account_id.account_type in ('asset_receivable', 'liability_payable'))

            domain = [
                ('account_id', 'in', pay_term_lines.account_id.ids),
                ('parent_state', '=', 'posted'),
                ('partner_id', '=', move.commercial_partner_id.id),
                ('reconciled', '=', False),
                '|', ('amount_residual', '!=', 0.0), ('amount_residual_currency', '!=', 0.0),
            ]

            payments_widget_vals = {'outstanding': True, 'content': [], 'move_id': move.id}

            if move.is_inbound():
                domain.append(('balance', '<', 0.0))
                payments_widget_vals['title'] = _('Outstanding credits')
            else:
                domain.append(('balance', '>', 0.0))
                payments_widget_vals['title'] = _('Outstanding debits')

            for line in self.env['account.move.line'].search(domain):

                if line.currency_id == move.currency_id:
                    # Same foreign currency.
                    amount = abs(line.amount_residual_currency)
                else:
                    # Different foreign currencies.
                    amount = line.company_currency_id._convert(
                        abs(line.amount_residual),
                        move.currency_id,
                        move.company_id,
                        line.date,
                    )

                if move.currency_id.is_zero(amount):
                    continue

                payments_widget_vals['content'].append({
                    'journal_name': line.ref or line.move_id.name,
                    'amount': amount,
                    'currency_id': move.currency_id.id,
                    'id': line.id,
                    'move_id': line.move_id.id,
                    'date': fields.Date.to_string(line.date),
                    'account_payment_id': line.payment_id.id,
                })

            if not payments_widget_vals['content']:
                continue

            move.invoice_outstanding_credits_debits_widget = payments_widget_vals
            move.invoice_has_outstanding = True

    @api.depends('move_type', 'line_ids.amount_residual')
    def _compute_payments_widget_reconciled_info(self):
        for move in self:
            payments_widget_vals = {'title': _('Less Payment'), 'outstanding': False, 'content': []}

            if move.state == 'posted' and move.is_invoice(include_receipts=True):
                reconciled_vals = []
                reconciled_partials = move.sudo()._get_all_reconciled_invoice_partials()
                for reconciled_partial in reconciled_partials:
                    counterpart_line = reconciled_partial['aml']
                    if counterpart_line.move_id.ref:
                        reconciliation_ref = '%s (%s)' % (counterpart_line.move_id.name, counterpart_line.move_id.ref)
                    else:
                        reconciliation_ref = counterpart_line.move_id.name
                    if counterpart_line.amount_currency and counterpart_line.currency_id != counterpart_line.company_id.currency_id:
                        foreign_currency = counterpart_line.currency_id
                    else:
                        foreign_currency = False

                    reconciled_vals.append({
                        'name': counterpart_line.name,
                        'journal_name': counterpart_line.journal_id.name,
                        'company_name': counterpart_line.journal_id.company_id.name if counterpart_line.journal_id.company_id != move.company_id else False,
                        'amount': reconciled_partial['amount'],
                        'currency_id': move.company_id.currency_id.id if reconciled_partial['is_exchange'] else reconciled_partial['currency'].id,
                        'date': counterpart_line.date,
                        'partial_id': reconciled_partial['partial_id'],
                        'account_payment_id': counterpart_line.payment_id.id,
                        'payment_method_name': counterpart_line.payment_id.payment_method_line_id.name,
                        'move_id': counterpart_line.move_id.id,
                        'ref': reconciliation_ref,
                        # these are necessary for the views to change depending on the values
                        'is_exchange': reconciled_partial['is_exchange'],
                        'amount_company_currency': formatLang(self.env, abs(counterpart_line.balance), currency_obj=counterpart_line.company_id.currency_id),
                        'amount_foreign_currency': foreign_currency and formatLang(self.env, abs(counterpart_line.amount_currency), currency_obj=foreign_currency)
                    })
                payments_widget_vals['content'] = reconciled_vals

            if payments_widget_vals['content']:
                move.invoice_payments_widget = payments_widget_vals
            else:
                move.invoice_payments_widget = False

    @api.depends_context('lang')
    @api.depends(
        'invoice_line_ids.currency_rate',
        'invoice_line_ids.tax_base_amount',
        'invoice_line_ids.tax_line_id',
        'invoice_line_ids.price_total',
        'invoice_line_ids.price_subtotal',
        'invoice_payment_term_id',
        'partner_id',
        'currency_id',
    )
    def _compute_tax_totals(self):
        """ Computed field used for custom widget's rendering.
            Only set on invoices.
        """
        for move in self:
            if move.is_invoice(include_receipts=True):
                base_lines = move._get_base_lines_for_taxes_computation(epd=True, cash_rounding=True)
                tax_lines = [
                    line._convert_to_tax_line_dict()
                    for line in move.line_ids.filtered(lambda line: line.display_type == 'tax')
                ]
                move.tax_totals = self.env['account.tax']._prepare_tax_totals(
                    base_lines=base_lines,
                    tax_lines=tax_lines,
                    company=move.company_id,
                    currency=move.currency_id or move.journal_id.currency_id or move.company_id.currency_id,
                )
            else:
                # Non-invoice moves don't support that field (because of multicurrency: all lines of the invoice share the same currency)
                move.tax_totals = None

    @api.depends('show_payment_term_details')
    def _compute_payment_term_details(self):
        '''
        Returns an [] containing the payment term's information to be displayed on the invoice's PDF.
        '''
        for invoice in self:
            invoice.payment_term_details = False
            if invoice.show_payment_term_details:
                sign = 1 if invoice.is_inbound(include_receipts=True) else -1
                payment_term_details = []
                for line in invoice.line_ids.filtered(lambda l: l.display_type == 'payment_term').sorted('date_maturity'):
                    payment_term_details.append({
                        'date': format_date(self.env, line.date_maturity),
                        'amount': sign * line.amount_currency,
                    })
                invoice.payment_term_details = payment_term_details

    @api.depends('move_type', 'payment_state', 'invoice_payment_term_id')
    def _compute_show_payment_term_details(self):
        '''
        Determines :
        - whether or not an additional table should be added at the end of the invoice to display the various
        - whether or not there is an early pay discount in this invoice that should be displayed
        '''
        for invoice in self:
            if invoice.move_type in ('out_invoice', 'out_receipt', 'in_invoice', 'in_receipt') and invoice.payment_state in ('not_paid', 'partial'):
                payment_term_lines = invoice.line_ids.filtered(lambda l: l.display_type == 'payment_term')
                invoice.show_discount_details = invoice.invoice_payment_term_id.early_discount
                invoice.show_payment_term_details = len(payment_term_lines) > 1 or invoice.show_discount_details
            else:
                invoice.show_discount_details = False
                invoice.show_payment_term_details = False

    def _need_cancel_request(self):
        """ Hook allowing a localization to prevent the user to reset draft an invoice that has been already sent
        to the government and thus, must remain untouched except if its cancellation is approved.

        :return: True if the cancel button is displayed instead of draft button, False otherwise.
        """
        self.ensure_one()
        return False

    @api.depends('country_code')
    def _compute_need_cancel_request(self):
        for move in self:
            move.need_cancel_request = move._need_cancel_request()

    @api.depends('partner_id', 'invoice_source_email', 'partner_id.display_name')
    def _compute_invoice_partner_display_info(self):
        for move in self:
            vendor_display_name = move.partner_id.display_name
            if not vendor_display_name:
                if move.invoice_source_email:
                    vendor_display_name = _('@From: %(email)s', email=move.invoice_source_email)
                else:
                    vendor_display_name = _('#Created by: %s', move.sudo().create_uid.name or self.env.user.name)
            move.invoice_partner_display_name = vendor_display_name

    @api.depends('move_type')
    def _compute_invoice_filter_type_domain(self):
        for move in self:
            if move.is_sale_document(include_receipts=True):
                move.invoice_filter_type_domain = 'sale'
            elif move.is_purchase_document(include_receipts=True):
                move.invoice_filter_type_domain = 'purchase'
            else:
                move.invoice_filter_type_domain = False

    @api.depends('commercial_partner_id')
    def _compute_bank_partner_id(self):
        for move in self:
            if move.is_inbound():
                move.bank_partner_id = move.company_id.partner_id
            else:
                move.bank_partner_id = move.commercial_partner_id

    @api.depends('date', 'line_ids.debit', 'line_ids.credit', 'line_ids.tax_line_id', 'line_ids.tax_ids', 'line_ids.tax_tag_ids',
                 'invoice_line_ids.debit', 'invoice_line_ids.credit', 'invoice_line_ids.tax_line_id', 'invoice_line_ids.tax_ids', 'invoice_line_ids.tax_tag_ids')
    def _compute_tax_lock_date_message(self):
        for move in self:
            accounting_date = move.date or fields.Date.context_today(move)
            affects_tax_report = move._affect_tax_report()
            move.tax_lock_date_message = move._get_lock_date_message(accounting_date, affects_tax_report)

    @api.depends('currency_id')
    def _compute_display_inactive_currency_warning(self):
        for move in self.with_context(active_test=False):
            move.display_inactive_currency_warning = move.state == 'draft' and move.currency_id and not move.currency_id.active

    @api.depends('company_id.account_fiscal_country_id', 'fiscal_position_id.country_id', 'fiscal_position_id.foreign_vat')
    def _compute_tax_country_id(self):
        foreign_vat_records = self.filtered(lambda r: r.fiscal_position_id.foreign_vat)
        for fiscal_position_id, record_group in groupby(foreign_vat_records, key=lambda r: r.fiscal_position_id):
            self.env['account.move'].concat(*record_group).tax_country_id = fiscal_position_id.country_id
        for company_id, record_group in groupby((self-foreign_vat_records), key=lambda r: r.company_id):
            self.env['account.move'].concat(*record_group).tax_country_id = company_id.account_fiscal_country_id

    @api.depends('tax_country_id')
    def _compute_tax_country_code(self):
        for record in self:
            record.tax_country_code = record.tax_country_id.code

    @api.depends('line_ids')
    def _compute_has_reconciled_entries(self):
        for move in self:
            move.has_reconciled_entries = len(move.line_ids._reconciled_lines()) > 1

    @api.depends('restrict_mode_hash_table', 'state', 'is_move_sent')
    def _compute_show_reset_to_draft_button(self):
        for move in self:
            move.show_reset_to_draft_button = (
                not self._is_move_restricted(move) \
                and (move.state == 'cancel' or (move.state == 'posted' and not move.need_cancel_request))
            )

    # EXTENDS portal portal.mixin
    def _compute_access_url(self):
        super()._compute_access_url()
        for move in self.filtered(lambda move: move.is_invoice()):
            move.access_url = '/my/invoices/%s' % (move.id)

    @api.depends('move_type', 'partner_id', 'company_id')
    def _compute_narration(self):
        use_invoice_terms = self.env['ir.config_parameter'].sudo().get_param('account.use_invoice_terms')
        for move in self:
            if not move.is_sale_document(include_receipts=True):
                continue
            if not use_invoice_terms:
                move.narration = False
            else:
                lang = move.partner_id.lang or self.env.user.lang
                if not move.company_id.terms_type == 'html':
                    narration = move.company_id.with_context(lang=lang).invoice_terms if not is_html_empty(move.company_id.invoice_terms) else ''
                else:
                    baseurl = self.env.company.get_base_url() + '/terms'
                    context = {'lang': lang}
                    narration = _('Terms & Conditions: %s', baseurl)
                    del context
                move.narration = narration or False

    def _get_partner_credit_warning_exclude_amount(self):
        # to extend in module 'sale'; see there for details
        self.ensure_one()
        return 0

    @api.depends('company_id', 'partner_id', 'tax_totals', 'currency_id')
    def _compute_partner_credit_warning(self):
        for move in self:
            move.with_company(move.company_id)
            move.partner_credit_warning = ''
            show_warning = move.state == 'draft' and \
                           move.move_type == 'out_invoice' and \
                           move.company_id.account_use_credit_limit
            if show_warning:
                total_field = 'amount_total' if move.currency_id == move.company_currency_id else 'amount_total_company_currency'
                current_amount = move.tax_totals[total_field]
                move.partner_credit_warning = self._build_credit_warning_message(
                    move,
                    current_amount=current_amount,
                    exclude_amount=move._get_partner_credit_warning_exclude_amount(),
                )

    @api.depends('partner_id')
    def _compute_partner_credit(self):
        for move in self:
            move.partner_credit = move.partner_id.commercial_partner_id.credit

    def _build_credit_warning_message(self, record, current_amount=0.0, exclude_current=False, exclude_amount=0.0):
        """ Build the warning message that will be displayed in a yellow banner on top of the current record
            if the partner exceeds a credit limit (set on the company or the partner itself).
            :param record:                  The record where the warning will appear (Invoice, Sales Order...).
            :param current_amount (float):  The partner's outstanding credit amount from the current document.
            :param exclude_current (bool):  DEPRECATED in favor of parameter `exclude_amount`:
                                            Whether to exclude `current_amount` from the credit to invoice.
            :param exclude_amount (float):  The amount to subtract from the partner's `credit_to_invoice`.
                                            Consider the warning on a draft invoice created from a sales order.
                                            After confirming the invoice the (partial) amount (on the invoice)
                                            stemming from sales orders will be substracted from the `credit_to_invoice`.
                                            This will reduce the total credit of the partner.
                                            This parameter is used to reflect this amount.
            :return (str):                  The warning message to be showed.
        """
        partner_id = record.partner_id.commercial_partner_id
        credit_to_invoice = partner_id.credit_to_invoice - exclude_amount
        total_credit = partner_id.credit + credit_to_invoice + current_amount
        if not partner_id.credit_limit or total_credit <= partner_id.credit_limit:
            return ''
        msg = _(
            '%(partner_name)s has reached its credit limit of: %(credit_limit)s',
            partner_name=partner_id.name,
            credit_limit=formatLang(self.env, partner_id.credit_limit, currency_obj=record.company_id.currency_id)
        )
        total_credit_formatted = formatLang(self.env, total_credit, currency_obj=record.company_id.currency_id)
        if credit_to_invoice > 0 and current_amount > 0:
            return msg + '\n' + _(
                'Total amount due (including sales orders and this document): %(total_credit)s',
                total_credit=total_credit_formatted
            )
        elif credit_to_invoice > 0:
            return msg + '\n' + _(
                'Total amount due (including sales orders): %(total_credit)s',
                total_credit=total_credit_formatted
            )
        elif current_amount > 0:
            return msg + '\n' + _(
                'Total amount due (including this document): %(total_credit)s',
                total_credit=total_credit_formatted
            )
        else:
            return msg + '\n' + _(
                'Total amount due: %(total_credit)s',
                total_credit=total_credit_formatted
            )

    @api.depends('journal_id.type', 'company_id')
    def _compute_quick_edit_mode(self):
        for move in self:
            quick_edit_mode = move.company_id.quick_edit_mode
            if move.journal_id.type == 'sale':
                move.quick_edit_mode = quick_edit_mode in ('out_invoices', 'out_and_in_invoices')
            elif move.journal_id.type == 'purchase':
                move.quick_edit_mode = quick_edit_mode in ('in_invoices', 'out_and_in_invoices')
            else:
                move.quick_edit_mode = False

    @api.depends('quick_edit_total_amount', 'invoice_line_ids.price_total', 'tax_totals')
    def _compute_quick_encoding_vals(self):
        for move in self:
            move.quick_encoding_vals = move._get_quick_edit_suggestions()

    @api.depends('ref', 'move_type', 'partner_id', 'invoice_date', 'tax_totals')
    def _compute_duplicated_ref_ids(self):
        move_to_duplicate_move = self._fetch_duplicate_reference()
        for move in self:
            # Uses move._origin.id to handle records in edition/existing records and 0 for new records
            move.duplicated_ref_ids = move_to_duplicate_move.get(move._origin, self.env['account.move'])

    def _fetch_duplicate_reference(self, matching_states=('draft', 'posted')):
        moves = self.filtered(lambda m: m.is_sale_document() or m.is_purchase_document() and m.ref)

        if not moves:
            return {}

        used_fields = ("company_id", "partner_id", "commercial_partner_id", "ref", "move_type", "invoice_date", "state", "amount_total")

        self.env["account.move"].flush_model(used_fields)

        move_table_and_alias = SQL("account_move AS move")
        if not moves[0].id:  # check if record is under creation/edition in UI
            # New record aren't searchable in the DB and record in edition aren't up to date yet
            # Replace the table by safely injecting the values in the query
            values = {
                field_name: moves._fields[field_name].convert_to_write(moves[field_name], moves) or None
                for field_name in used_fields
            }
            values["id"] = moves._origin.id or 0
            # The amount total depends on the field line_ids and is calculated upon saving, we needed a way to get it even when the
            # invoices has not been saved yet.
            values['amount_total'] = self.tax_totals.get('amount_total', 0)
            casted_values = SQL(', ').join(
                SQL("%s::%s", value, SQL.identifier(moves._fields[field_name].column_type[0]))
                for field_name, value in values.items()
            )
            column_names = SQL(', ').join(SQL.identifier(field_name) for field_name in values)
            move_table_and_alias = SQL("(VALUES (%s)) AS move(%s)", casted_values, column_names)

        result = self.env.execute_query(SQL("""
            SELECT
                   move.id AS move_id,
                   array_agg(duplicate_move.id) AS duplicate_ids
              FROM %(move_table_and_alias)s
              JOIN account_move AS duplicate_move ON
                   move.company_id = duplicate_move.company_id
               AND move.id != duplicate_move.id
               AND duplicate_move.state IN %(matching_states)s
               AND move.move_type = duplicate_move.move_type
               AND (
                   move.commercial_partner_id = duplicate_move.commercial_partner_id
                   OR (move.commercial_partner_id IS NULL AND duplicate_move.state = 'draft')
                )
               AND (
                   -- For out moves
                   move.move_type in ('out_invoice', 'out_refund')
                   AND (
                       move.amount_total = duplicate_move.amount_total
                       AND move.invoice_date = duplicate_move.invoice_date
                   )
                   OR
                   -- For in moves
                   move.move_type in ('in_invoice', 'in_refund')
                   AND (
                       move.ref = duplicate_move.ref
                       AND (move.invoice_date = duplicate_move.invoice_date OR move.state = 'draft')
                   )
               )
             WHERE move.id IN %(moves)s
             GROUP BY move.id
            """,
            matching_states=tuple(matching_states),
            moves=tuple(moves.ids or [0]),
            move_table_and_alias=move_table_and_alias,
        ))
        return {
            self.env['account.move'].browse(move_id): self.env['account.move'].browse(duplicate_ids)
            for move_id, duplicate_ids in result
        }

    @api.depends('company_id')
    def _compute_display_qr_code(self):
        for move in self:
            move.display_qr_code = (
                move.move_type in ('out_invoice', 'out_receipt', 'in_invoice', 'in_receipt')
                and move.company_id.qr_code
            )

    @api.depends('amount_total', 'currency_id')
    def _compute_amount_total_words(self):
        for move in self:
            move.amount_total_words = move.currency_id.amount_to_text(move.amount_total).replace(',', '')

    def _compute_linked_attachment_id(self, attachment_field, binary_field):
        """Helper to retreive Attachment from Binary fields
        This is needed because fields.Many2one('ir.attachment') makes all
        attachments available to the user.
        """
        attachments = self.env['ir.attachment'].search([
            ('res_model', '=', self._name),
            ('res_id', 'in', self.ids),
            ('res_field', '=', binary_field)
        ])
        move_vals = {att.res_id: att for att in attachments}
        for move in self:
            move[attachment_field] = move_vals.get(move._origin.id, False)

    def _compute_incoterm_location(self):
        pass

    @api.depends('partner_id', 'invoice_date', 'amount_total')
    def _compute_abnormal_warnings(self):
        """Assign warning fields based on historical data.

        The last invoices (between 10 and 30) are used to compute the normal distribution.
        If the amount or days between invoices of the current invoice falls outside of the boundaries
        of the Bell curve, we warn the user.
        """
        if self.env.context.get('disable_abnormal_invoice_detection'):
            draft_invoices = self.browse()
        else:
            draft_invoices = self.filtered(lambda m:
                m.is_purchase_document()
                and m.state == 'draft'
                and m.amount_total
                and not (m.partner_id.ignore_abnormal_invoice_date and m.partner_id.ignore_abnormal_invoice_amount)
            )
        other_moves = self - draft_invoices
        other_moves.abnormal_amount_warning = False
        other_moves.abnormal_date_warning = False
        if not draft_invoices:
            return
        draft_invoices.flush_recordset(['invoice_date', 'date', 'amount_total', 'partner_id', 'move_type', 'company_id'])
        today = fields.Date.context_today(self)
        self.env.cr.execute("""
            WITH previous_invoices AS (
                  SELECT this.id,
                         other.invoice_date,
                         other.amount_total,
                         LAG(other.invoice_date) OVER invoice - other.invoice_date AS date_diff
                    FROM account_move this
                    JOIN account_move other USING (partner_id, move_type, company_id, currency_id)
                   WHERE other.state = 'posted'
                     AND other.invoice_date <= COALESCE(this.invoice_date, this.date, %(today)s)
                     AND this.id = ANY(%(move_ids)s)
                     AND this.id != other.id
                  WINDOW invoice AS (PARTITION BY this.id ORDER BY other.invoice_date DESC)
            ), stats AS (
                  SELECT id,
                         MAX(invoice_date)          OVER invoice AS last_invoice_date,
                         AVG(date_diff)             OVER invoice AS date_diff_mean,
                         STDDEV_SAMP(date_diff)     OVER invoice AS date_diff_deviation,
                         AVG(amount_total)          OVER invoice AS amount_mean,
                         STDDEV_SAMP(amount_total)  OVER invoice AS amount_deviation,
                         ROW_NUMBER()               OVER invoice AS row_number
                    FROM previous_invoices
                  WINDOW invoice AS (PARTITION BY id ORDER BY invoice_date DESC)
            )
              SELECT id, last_invoice_date, date_diff_mean, date_diff_deviation, amount_mean, amount_deviation
                FROM stats
               WHERE row_number BETWEEN 10 AND 30
            ORDER BY row_number ASC
        """, {
            'today': today,
            'move_ids': draft_invoices.ids,
        })
        result = {invoice: vals for invoice, *vals in self.env.cr.fetchall()}
        for move in draft_invoices:
            invoice_date = move.invoice_date or today
            (
                last_invoice_date, date_diff_mean, date_diff_deviation,
                amount_mean, amount_deviation,
            ) = result.get(move._origin.id, (invoice_date, 0, 10000000000, 0, 10000000000))

            if date_diff_mean > 25:
                # Correct for varying days per month and leap years
                # If we have a recurring invoice every month, the mean will be ~30.5 days, and the deviation ~1 day.
                # We need to add some wiggle room for the month of February otherwise it will trigger because 28 days is outside of the range
                date_diff_deviation += 1

            wiggle_room_date = 2 * date_diff_deviation
            move.abnormal_date_warning = (
                not move.partner_id.ignore_abnormal_invoice_date
                and (invoice_date - last_invoice_date).days < int(date_diff_mean - wiggle_room_date)
            ) and _(
                "The billing frequency for %(partner_name)s appears unusual. Based on your historical data, "
                "the expected next invoice date is not before %(expected_date)s (every %(mean)s (± %(wiggle)s) days).\n"
                "Please verify if this date is accurate.",
                partner_name=move.partner_id.display_name,
                expected_date=format_date(self.env, fields.Date.add(last_invoice_date, days=int(date_diff_mean - wiggle_room_date))),
                mean=int(date_diff_mean),
                wiggle=int(wiggle_room_date),
            )

            wiggle_room_amount = 2 * amount_deviation
            move.abnormal_amount_warning = (
                not move.partner_id.ignore_abnormal_invoice_amount
                and not (amount_mean - wiggle_room_amount <= move.amount_total <= amount_mean + wiggle_room_amount)
            ) and _(
                "The amount for %(partner_name)s appears unusual. Based on your historical data, the expected amount is %(mean)s (± %(wiggle)s).\n"
                "Please verify if this amount is accurate.",
                partner_name=move.partner_id.display_name,
                mean=move.currency_id.format(amount_mean),
                wiggle=move.currency_id.format(wiggle_room_amount),
            )

    @api.depends('line_ids.tax_ids')
    def _compute_taxes_legal_notes(self):
        for move in self:
            move.taxes_legal_notes = ''.join(
                tax.invoice_legal_notes
                for tax in OrderedSet(move.line_ids.tax_ids)
                if not is_html_empty(tax.invoice_legal_notes)
            )

    # -------------------------------------------------------------------------
    # INVERSE METHODS
    # -------------------------------------------------------------------------

    def _inverse_amount_total(self):
        for move in self:
            if len(move.line_ids) != 2 or move.is_invoice(include_receipts=True):
                continue

            to_write = []

            amount_currency = abs(move.amount_total)
            balance = move.currency_id._convert(amount_currency, move.company_currency_id, move.company_id, move.invoice_date or move.date)

            for line in move.line_ids:
                if not line.currency_id.is_zero(balance - abs(line.balance)):
                    to_write.append((1, line.id, {
                        'debit': line.balance > 0.0 and balance or 0.0,
                        'credit': line.balance < 0.0 and balance or 0.0,
                        'amount_currency': line.balance > 0.0 and amount_currency or -amount_currency,
                    }))

            move.write({'line_ids': to_write})

    @api.onchange('company_id')
    def _inverse_company_id(self):
        for move in self:
            # This can't be caught by a python constraint as it is only triggered at save and the compute method that
            # needs this data to be set correctly before saving
            if not move.company_id:
                raise ValidationError(_("We can't leave this document without any company. Please select a company for this document."))
        self._conditional_add_to_compute('journal_id', lambda m: (
            not m.journal_id.filtered_domain(self.env['account.journal']._check_company_domain(m.company_id))
        ))

    # @api.onchange('currency_id')
    # def _inverse_currency_id(self):
    #     (self.line_ids | self.invoice_line_ids)._conditional_add_to_compute('currency_id', lambda l: (
    #         l.move_id.is_invoice(True)
    #         and l.move_id.currency_id != l.currency_id
    #     ))

    @api.onchange('journal_id')
    def _inverse_journal_id(self):
        self._conditional_add_to_compute('company_id', lambda m: (
            not m.company_id
            or m.company_id != m.journal_id.company_id
        ))
        self._conditional_add_to_compute('currency_id', lambda m: (
            not m.currency_id
            or m.journal_id.currency_id and m.currency_id != m.journal_id.currency_id
        ))

    def _inverse_name(self):
        self._conditional_add_to_compute('payment_reference', lambda move: (
            move.name and move.name != '/'
        ))
        self._set_next_made_sequence_gap(False)

    # -------------------------------------------------------------------------
    # ONCHANGE METHODS
    # -------------------------------------------------------------------------

    # @api.onchange('date')
    # def _onchange_date(self):
    #     if not self.is_invoice(True):
    #         self.line_ids._inverse_amount_currency()

    @api.onchange('invoice_vendor_bill_id')
    def _onchange_invoice_vendor_bill(self):
        if self.invoice_vendor_bill_id:
            # Copy invoice lines.
            for line in self.invoice_vendor_bill_id.invoice_line_ids:
                copied_vals = line.copy_data()[0]
                self.invoice_line_ids += self.env['account.move.line'].new(copied_vals)

            self.currency_id = self.invoice_vendor_bill_id.currency_id
            self.fiscal_position_id = self.invoice_vendor_bill_id.fiscal_position_id

            # Reset
            self.invoice_vendor_bill_id = False

    @api.onchange('fiscal_position_id')
    def _onchange_fpos_id_show_update_fpos(self):
        self.show_update_fpos = self.line_ids and self._origin.fiscal_position_id != self.fiscal_position_id

    @api.onchange('partner_id')
    def _onchange_partner_id(self):
        self = self.with_company((self.journal_id.company_id or self.env.company)._accessible_branches()[:1])

        warning = {}
        if self.partner_id:
            rec_account = self.partner_id.property_account_receivable_id
            pay_account = self.partner_id.property_account_payable_id
            if not rec_account and not pay_account:
                action = self.env.ref('account.action_account_config')
                msg = _('Cannot find a chart of accounts for this company, You should configure it. \nPlease go to Account Configuration.')
                raise RedirectWarning(msg, action.id, _('Go to the configuration panel'))
            p = self.partner_id
            if p.invoice_warn == 'no-message' and p.parent_id:
                p = p.parent_id
            if p.invoice_warn and p.invoice_warn != 'no-message':
                # Block if partner only has warning but parent company is blocked
                if p.invoice_warn != 'block' and p.parent_id and p.parent_id.invoice_warn == 'block':
                    p = p.parent_id
                warning = {
                    'title': _("Warning for %s", p.name),
                    'message': p.invoice_warn_msg
                }
                if p.invoice_warn == 'block':
                    self.partner_id = False
                return {'warning': warning}

    @api.onchange('name', 'highest_name')
    def _onchange_name_warning(self):
        if self.name and self.name != '/' and self.name <= (self.highest_name or '') and not self.quick_edit_mode:
            self.show_name_warning = True
        else:
            self.show_name_warning = False

        origin_name = self._origin.name
        if not origin_name or origin_name == '/':
            origin_name = self.highest_name
        if (
            self.name and self.name != '/'
            and origin_name and origin_name != '/'
            and self.date == self._origin.date
            and self.journal_id == self._origin.journal_id
        ):
            new_format, new_format_values = self._get_sequence_format_param(self.name)
            origin_format, origin_format_values = self._get_sequence_format_param(origin_name)

            if (
                new_format != origin_format
                or dict(new_format_values, year=0, month=0, seq=0) != dict(origin_format_values, year=0, month=0, seq=0)
            ):
                changed = _(
                    "It was previously '%(previous)s' and it is now '%(current)s'.",
                    previous=origin_name,
                    current=self.name,
                )
                reset = self._deduce_sequence_number_reset(self.name)
                if reset == 'month':
                    detected = _(
                        "The sequence will restart at 1 at the start of every month.\n"
                        "The year detected here is '%(year)s' and the month is '%(month)s'.\n"
                        "The incrementing number in this case is '%(formatted_seq)s'."
                    )
                elif reset == 'year':
                    detected = _(
                        "The sequence will restart at 1 at the start of every year.\n"
                        "The year detected here is '%(year)s'.\n"
                        "The incrementing number in this case is '%(formatted_seq)s'."
                    )
                elif reset == 'year_range':
                    detected = _(
                        "The sequence will restart at 1 at the start of every financial year.\n"
                        "The financial start year detected here is '%(year)s'.\n"
                        "The financial end year detected here is '%(year_end)s'.\n"
                        "The incrementing number in this case is '%(formatted_seq)s'."
                    )
                else:
                    detected = _(
                        "The sequence will never restart.\n"
                        "The incrementing number in this case is '%(formatted_seq)s'."
                    )
                new_format_values['formatted_seq'] = "{seq:0{seq_length}d}".format(**new_format_values)
                detected = detected % new_format_values
                return {'warning': {
                    'title': _("The sequence format has changed."),
                    'message': "%s\n\n%s" % (changed, detected)
                }}

    @api.onchange('journal_id')
    def _onchange_journal_id(self):
        if not self.quick_edit_mode:
            self.name = '/'
            self._compute_name()

    @api.onchange('invoice_cash_rounding_id')
    def _onchange_invoice_cash_rounding_id(self):
        for move in self:
            if move.invoice_cash_rounding_id.strategy == 'add_invoice_line' and not move.invoice_cash_rounding_id.profit_account_id:
                return {'warning': {
                    'title': _("Warning for Cash Rounding Method: %s", move.invoice_cash_rounding_id.name),
                    'message': _("You must specify the Profit Account (company dependent)")
                }}

    @api.onchange('tax_totals')
    def _onchange_tax_totals(self):
        self.ensure_one()
        tax_totals = self.tax_totals
        if not tax_totals or 'changed_tax_group_id' not in tax_totals or 'delta_amount_currency' not in tax_totals:
            return

        changed_tax_group_id = tax_totals['changed_tax_group_id']
        rate = self.invoice_currency_rate
        sign = self.direction_sign
        delta_amount_currency = tax_totals['delta_amount_currency']
        delta_balance = self.company_currency_id.round(delta_amount_currency / rate) if rate else 0.0
        tax_line = self.line_ids \
            .filtered(lambda line: line.display_type == 'tax' and line.tax_line_id.tax_group_id.id == changed_tax_group_id) \
            .sorted(key=lambda line: sign * line.amount_currency)[:1]
        sync_tax_totals = {
            self: {
                'sync_display_type': {
                    frozendict({'id': tax_line.id}): {
                        'amount_currency': tax_line.amount_currency + (sign * delta_amount_currency),
                        'balance': tax_line.balance + (sign * delta_balance),
                    },
                },
            },
        }
        self._update_moves_per_batch(sync_tax_totals)

    # -------------------------------------------------------------------------
    # CONSTRAINT METHODS
    # -------------------------------------------------------------------------

    @contextmanager
    def _check_balanced(self, container):
        ''' Assert the move is fully balanced debit = credit.
        An error is raised if it's not the case.
        '''
        with self._disable_recursion(container, 'check_move_validity', default=True, target=False) as disabled:
            yield
            if disabled:
                return

        unbalanced_moves = self._get_unbalanced_moves(container)
        if unbalanced_moves:
            error_msg = _("An error has occurred.")
            for move_id, sum_debit, sum_credit in unbalanced_moves:
                move = self.browse(move_id)
                error_msg += _(
                    "\n\n"
                    "The move (%(move)s) is not balanced.\n"
                    "The total of debits equals %(debit_total)s and the total of credits equals %(credit_total)s.\n"
                    "You might want to specify a default account on journal \"%(journal)s\" to automatically balance each move.",
                    move=move.display_name,
                    debit_total=format_amount(self.env, sum_debit, move.company_id.currency_id),
                    credit_total=format_amount(self.env, sum_credit, move.company_id.currency_id),
                    journal=move.journal_id.name)
            raise UserError(error_msg)

    def _get_unbalanced_moves(self, container):
        moves = container['records'].filtered(lambda move: move.line_ids)
        if not moves:
            return

        # /!\ As this method is called in create / write, we can't make the assumption the computed stored fields
        # are already done. Then, this query MUST NOT depend on computed stored fields.
        # It happens as the ORM calls create() with the 'no_recompute' statement.
        self.env['account.move.line'].flush_model(['debit', 'credit', 'balance', 'currency_id', 'move_id'])
        return self.env.execute_query(SQL('''
            SELECT line.move_id,
                   ROUND(SUM(line.debit), currency.decimal_places) debit,
                   ROUND(SUM(line.credit), currency.decimal_places) credit
              FROM account_move_line line
              JOIN account_move move ON move.id = line.move_id
              JOIN res_company company ON company.id = move.company_id
              JOIN res_currency currency ON currency.id = company.currency_id
             WHERE line.move_id IN %s
          GROUP BY line.move_id, currency.decimal_places
            HAVING ROUND(SUM(line.balance), currency.decimal_places) != 0
        ''', tuple(moves.ids)))

    def _check_fiscalyear_lock_date(self):
        for move in self:
            lock_date = move.company_id._get_user_fiscal_lock_date()
            if move.date <= lock_date:
                if self.env.user.has_group('account.group_account_manager'):
                    message = _("You cannot add/modify entries prior to and inclusive of the lock date %s.", format_date(self.env, lock_date))
                else:
                    message = _("You cannot add/modify entries prior to and inclusive of the lock date %s. Check the company settings or ask someone with the 'Adviser' role", format_date(self.env, lock_date))
                raise UserError(message)
        return True

    @api.constrains('auto_post', 'invoice_date')
    def _require_bill_date_for_autopost(self):
        """Vendor bills must have an invoice date set to be posted. Require it for auto-posted bills."""
        for record in self:
            if record.auto_post != 'no' and record.is_purchase_document() and not record.invoice_date:
                raise ValidationError(_("For this entry to be automatically posted, it required a bill date."))

    @api.constrains('journal_id', 'move_type')
    def _check_journal_move_type(self):
        for move in self:
            if move.is_purchase_document(include_receipts=True) and move.journal_id.type != 'purchase':
                raise ValidationError(_("Cannot create a purchase document in a non purchase journal"))
            if move.is_sale_document(include_receipts=True) and move.journal_id.type != 'sale':
                raise ValidationError(_("Cannot create a sale document in a non sale journal"))

    @api.constrains('line_ids', 'fiscal_position_id', 'company_id')
    def _validate_taxes_country(self):
        """ By playing with the fiscal position in the form view, it is possible to keep taxes on the invoices from
        a different country than the one allowed by the fiscal country or the fiscal position.
        This contrains ensure such account.move cannot be kept, as they could generate inconsistencies in the reports.
        """
        for record in self:
            amls = record.line_ids
            impacted_countries = amls.tax_ids.country_id | amls.tax_line_id.country_id
            if impacted_countries and impacted_countries != record.tax_country_id:
                if record.fiscal_position_id and impacted_countries != record.fiscal_position_id.country_id:
                    raise ValidationError(_("This entry contains taxes that are not compatible with your fiscal position. Check the country set in fiscal position and in your tax configuration."))
                raise ValidationError(_("This entry contains one or more taxes that are incompatible with your fiscal country. Check company fiscal country in the settings and tax country in taxes configuration."))

    # -------------------------------------------------------------------------
    # CATALOG
    # -------------------------------------------------------------------------
    def action_add_from_catalog(self):
        res = super().action_add_from_catalog()
        if res['context'].get('product_catalog_order_model') == 'account.move':
            res['search_view_id'] = [self.env.ref('account.product_view_search_catalog').id, 'search']
        return res

    def _get_action_add_from_catalog_extra_context(self):
        res = super()._get_action_add_from_catalog_extra_context()
        if self.is_purchase_document() and self.partner_id:
            res['search_default_seller_ids'] = self.partner_id.name

        res['product_catalog_currency_id'] = self.currency_id.id
        res['product_catalog_digits'] = self.line_ids._fields['price_unit'].get_digits(self.env)
        return res

    def _get_product_catalog_domain(self):
        if self.is_sale_document():
            return expression.AND([super()._get_product_catalog_domain(), [('sale_ok', '=', True)]])
        elif self.is_purchase_document():
            return expression.AND([super()._get_product_catalog_domain(), [('purchase_ok', '=', True)]])
        else:  # In case of an entry
            return super()._get_product_catalog_domain()

    def _default_order_line_values(self, child_field=False):
        default_data = super()._default_order_line_values(child_field)
        new_default_data = self.env['account.move.line']._get_product_catalog_lines_data()
        return {**default_data, **new_default_data}

    def _get_product_catalog_order_data(self, products, **kwargs):
        product_catalog = super()._get_product_catalog_order_data(products, **kwargs)
        for product in products:
            product_catalog[product.id] |= self._get_product_price_and_data(product)
        return product_catalog

    def _get_product_price_and_data(self, product):
        """
            This function will return a dict containing the price of the product. If the product is a sale document then
            we return the list price (which is the "Sales Price" in a product) otherwise we return the standard_price
            (which is the "Cost" in a product).
            In case of a purchase document, it's possible that we have special price for certain partner.
            We will check the sellers set on the product and update the price and min_qty for it if needed.
        """
        self.ensure_one()
        product_infos = {'price': product.list_price if self.is_sale_document() else product.standard_price}

        # Check if there is a price and a minimum quantity for the order's vendor.
        if self.is_purchase_document() and self.partner_id:
            seller = product._select_seller(
                partner_id=self.partner_id,
                quantity=None,
                date=self.invoice_date,
                uom_id=product.uom_id,
                ordered_by='min_qty',
                params={'order_id': self}
            )
            if seller:
                product_infos.update(
                    price=seller.price,
                    min_qty=seller.min_qty,
                )
        return product_infos

    def _get_product_catalog_record_lines(self, product_ids, child_field=False):
        grouped_lines = defaultdict(lambda: self.env['account.move.line'])
        for line in self.line_ids:
            if line.display_type == 'product' and line.product_id.id in product_ids:
                grouped_lines[line.product_id] |= line
        return grouped_lines

    def _update_order_line_info(self, product_id, quantity, **kwargs):
        """ Update account_move_line information for a given product or create a
        new one if none exists yet.
        :param int product_id: The product, as a `product.product` id.
        :param int quantity: The quantity selected in the catalog
        :return: The unit price of the product, based on the pricelist of the
                 sale order and the quantity selected.
        :rtype: float
        """
        move_line = self.line_ids.filtered(lambda line: line.product_id.id == product_id)
        if move_line:
            if quantity != 0:
                move_line.quantity = quantity
            elif self.state in {'draft', 'sent'}:
                price_unit = self._get_product_price_and_data(move_line.product_id)['price']
                # The catalog is designed to allow the user to select products quickly.
                # Therefore, sometimes they may select the wrong product or decide to remove
                # some of them from the quotation. The unlink is there for that reason.
                move_line.unlink()
                return price_unit
            else:
                move_line.quantity = 0
        elif quantity > 0:
            move_line = self.env['account.move.line'].create({
                'move_id': self.id,
                'quantity': quantity,
                'product_id': product_id,
            })
        return move_line.price_unit

    def _is_readonly(self):
        """
            Check if the move has been canceled
        """
        self.ensure_one()
        return self.state == 'cancel'

    # -------------------------------------------------------------------------
    # EARLY PAYMENT DISCOUNT
    # -------------------------------------------------------------------------
    def _is_eligible_for_early_payment_discount(self, currency, reference_date):
        self.ensure_one()
        return self.currency_id == currency \
            and self.move_type in ('out_invoice', 'out_receipt', 'in_invoice', 'in_receipt') \
            and self.invoice_payment_term_id.early_discount \
            and (not reference_date or reference_date <= self.invoice_payment_term_id._get_last_discount_date(self.invoice_date)) \
            and self.payment_state == 'not_paid'

    # -------------------------------------------------------------------------
    # BUSINESS MODELS SYNCHRONIZATION
    # -------------------------------------------------------------------------

    def _synchronize_business_models(self, changed_fields):
        ''' Ensure the consistency between:
        account.payment & account.move
        account.bank.statement.line & account.move

        The idea is to call the method performing the synchronization of the business
        models regarding their related journal entries. To avoid cycling, the
        'skip_account_move_synchronization' key is used through the context.

        :param changed_fields: A set containing all modified fields on account.move.
        '''
        if self._context.get('skip_account_move_synchronization'):
            return

        self_sudo = self.sudo()
        self_sudo.payment_id._synchronize_from_moves(changed_fields)
        self_sudo.statement_line_id._synchronize_from_moves(changed_fields)

    # -------------------------------------------------------------------------
    # DYNAMIC LINES: HELPERS
    # -------------------------------------------------------------------------

    @api.model
    def _track_record_field(self, record, field_name):
        return record._fields[field_name].convert_to_write(record[field_name], record)

    @api.model
    def _tracked_fields_before(self, container):
        field_names = container['field_names']
        container.setdefault('changed_field_names', set())
        diff_records = container.setdefault('diff', {})
        for record in container['records']:
            diff_records.setdefault(record, {})
        container['data_before'] = {
            record: {
                field_name: (
                    diff_records[record][field_name]
                    if field_name in diff_records[record]
                    else self._track_record_field(record, field_name)
                )
                for field_name in field_names
            }
            for record in container['records']
        }

    @api.model
    def _tracked_fields_after(self, container):
        data_before = container['data_before']
        diff_records = container['diff']
        field_names = container['field_names']
        diff_field_names = container['changed_field_names']
        for record in container['records']:
            diff_records.setdefault(record, {})
        data_after = {
            record: {
                field_name: self._track_record_field(record, field_name)
                for field_name in field_names
            }
            for record in container['records'].exists()
        }

        # Diff.
        for record, diff in diff_records.items():
            record_diff_before = data_before.get(record)
            record_diff_after = data_after.get(record)
            for field_name in field_names:
                field_diff = diff.get(field_name, [None, None])
                if record_diff_before:
                    field_diff[0] = record_diff_before[field_name]
                if record_diff_after:
                    field_diff[1] = record_diff_after[field_name]
                if field_diff[0] != field_diff[1]:
                    diff[field_name] = field_diff
                    diff_field_names.add(field_name)

    @contextmanager
    def _tracked_fields(self, container):
        self._tracked_fields_before(container)
        yield
        self._tracked_fields_after(container)

    @api.model
    def _field_has_changed(self, container, field_names, records=None, domain=None):
        if domain:
            records = container['records'].exists().filtered_domain(domain)

        if records is not None:
            for record in records:
                if any(field_name in container['diff'][record] for field_name in field_names):
                    return True
            return False
        else:
            return bool(container['changed_field_names'].intersection(field_names))

    @api.model
    def _record_has_been_removed(self, container, move, display_types=None):
        for record, values in container['data_before'].items():
            if values['move_id'] == move.id and (not display_types or values['display_type'] in display_types) and not record.exists():
                return True
        return False

    @api.model
    def _record_has_been_created(self, container, record):
        return record not in container['data_before']

    @api.model
    def _sync_lines_from_display_type(
        self,
        move_container,
        lines_container,
        display_type,
        dirty_function,
        populate_function,
    ):

        def sanitize_grouping_key(grouping_key):
            return frozendict({
                k: v if k == 'id' else v or False  # NewId are Falsy
                for k, v in grouping_key.items()
            })

        sync_lines_diff = defaultdict(lambda: {
            'create': [],
            'update': {},
            'unlink': set(),
        })
        for move in move_container['records'].exists():
            is_dirty, dirty_values = dirty_function(move)
            if not is_dirty:
                continue

            move_sync_lines_diff = sync_lines_diff[move]
            results = {'grouping_keys': {}, 'dirty': dirty_values}
            populate_function(move, results)

            # Collect the candidates to synchronize.
            candidates = move.line_ids.filtered(lambda line: line.display_type == display_type)

            # If nothing to synchronize, just remove all the candidates.
            grouping_keys = results['grouping_keys']
            if not grouping_keys:
                for candidate in candidates:
                    move_sync_lines_diff['unlink'].add(candidate.id)
                continue

            # Update the existing candidates if possible.
            field_names = next(iter(grouping_keys.keys())).keys()
            candidates_per_grouping_key = {}
            for candidate in candidates:
                candidates_per_grouping_key \
                    .setdefault(sanitize_grouping_key(self._build_line_grouping_key(candidate, field_names)), []) \
                    .append(candidate)

            for grouping_key, to_update in grouping_keys.items():
                grouping_key = sanitize_grouping_key(grouping_key)
                to_update['display_type'] = display_type

                if candidates := candidates_per_grouping_key.get(grouping_key):
                    candidate = candidates[0]
                    to_update = self.env['account.move.line']._sanitize_values_write(candidate, to_update)
                    move_sync_lines_diff['update'][candidate.id] = {
                        k: v
                        for k, v in to_update.items()
                        if candidate._fields[k].type == 'monetary'
                    }
                    for trailing_candidate in candidates[1:]:
                        move_sync_lines_diff['unlink'].add(trailing_candidate.id)
                    del candidates_per_grouping_key[grouping_key]
                else:
                    to_update = self.env['account.move.line']._sanitize_values_create(move, to_update)
                    move_sync_lines_diff['create'].append({**grouping_key, **to_update, 'move_id': move.id})

            for candidates in candidates_per_grouping_key.values():
                for candidate in candidates:
                    move_sync_lines_diff['unlink'].add(candidate.id)

        sub_lines_container = {**lines_container, 'records': self.env['account.move.line']}
        with self._tracked_fields(sub_lines_container ):
            sub_lines_container['records'] |= self._apply_sync_lines_diff(sync_lines_diff)

    @api.model
    def _sync_lines(
        self,
        move_container,
        lines_container,
        dirty_function,
        populate_function,
    ):
        sync_lines_diff = defaultdict(lambda: {
            'create': [],
            'update': {},
            'unlink': set(),
        })
        for move in move_container['records'].exists():
            is_dirty, dirty_values = dirty_function(move)
            if not is_dirty:
                continue

            results = {'update': {}, 'create': [], 'unlink': set(), 'dirty': dirty_values}
            populate_function(move, results)
            sync_lines_diff[move]['update'].update(results['update'])
            for create_values in results['create']:
                create_values['move_id'] = move.id
                sync_lines_diff[move]['create'].append(create_values)
            sync_lines_diff[move]['unlink'].update(results['unlink'])

        sub_lines_container = {**lines_container, 'records': self.env['account.move.line']}
        with self._tracked_fields(sub_lines_container):
            sub_lines_container['records'] |= self._apply_sync_lines_diff(sync_lines_diff)

    @api.model
    def _sync_dynamic_lines_pre_yield(self, move_container, lines_container=None):
        lines_container = lines_container or {'records': move_container['records'].line_ids}
        move_container['field_names'] = set().union(
            self._get_move_invoice_fields_sync_taxes(),
            self._get_invoice_fields_sync_epd(),
            self._get_invoice_fields_sync_discount(),
            self._get_invoice_fields_sync_cash_rounding(),
            self._get_invoice_fields_sync_payment_term(),
            {'partner_id'},
        )
        lines_container['field_names'] = self.env['account.move.line']._sync_dynamic_lines_tracked_fields()
        self._tracked_fields_before(move_container)
        self._tracked_fields_before(lines_container)
        return {
            'move_container': move_container,
            'lines_container': lines_container,
        }

    @api.model
    def _sync_dynamic_lines_after_yield(self, data_pre_yield):
        move_container = data_pre_yield['move_container']
        lines_container = data_pre_yield['lines_container']
        self._tracked_fields_after(move_container)
        self._tracked_fields_after(lines_container)

        self._sync_quick_encoding_lines(move_container, lines_container)
        product_tax_details_per_move = self._prepare_product_tax_details_per_move(move_container, lines_container)
        self._sync_product_lines(move_container, lines_container, product_tax_details_per_move)
        self._sync_epd_lines(move_container, lines_container, product_tax_details_per_move)
        epd_tax_details_per_move = self._prepare_epd_tax_details_per_move(move_container)
        self._sync_tax_lines(move_container, lines_container, product_tax_details_per_move, epd_tax_details_per_move)
        self._sync_quick_encoding_lines_fix_total_amount(move_container, lines_container)
        self._sync_discount_lines(move_container, lines_container)

        # Cash rounding.
        values_per_move = self._sync_cash_rounding_lines(move_container, lines_container)
        sub_lines_container = {**lines_container, 'records': self.env['account.move.line']}
        with self._tracked_fields(sub_lines_container):
            sub_lines_container['records'] |= self._update_moves_per_batch(values_per_move)

        # Payment terms.
        self._sync_payment_term_lines(move_container, lines_container)

        # Sync date_maturity / payment_reference.
        values_per_move = self._sync_date_maturity(move_container, lines_container)
        sub_move_container = {**move_container, 'records': self.env['account.move.line']}
        with self._tracked_fields(sub_move_container):
            for move, sync_values in values_per_move.items():
                (move.write if move.id else move.update)(sync_values)

        # Auto balancing of misc lines.
        values_per_move = self._sync_unbalanced_lines(move_container, lines_container, product_tax_details_per_move)
        sub_lines_container = {**lines_container, 'records': self.env['account.move.line']}
        with self._tracked_fields(sub_lines_container):
            sub_lines_container['records'] |= self._update_moves_per_batch(values_per_move)

        # Cleanup the hacky field to track the fields of lines during the onchange.
        for line in lines_container['records'].exists():
            line.last_onchange_fields = False

    @contextmanager
    def _sync_dynamic_lines(self, move_container, lines_container=None):
        with self._disable_recursion(move_container, 'skip_invoice_sync') as disabled:
            if disabled:
                yield
                return

            data_pre_yield = self._sync_dynamic_lines_pre_yield(move_container, lines_container=lines_container)
            yield
            self._sync_dynamic_lines_after_yield(data_pre_yield)

    @api.model
    def _build_line_grouping_key(self, line, field_names):
        return {
            field_name: line._fields[field_name].convert_to_write(line[field_name], line)
            for field_name in field_names
        }

    def _convert_sync_values_to_line_ids_commands(self, values):
        self.ensure_one()

        def sanitize_grouping_key(grouping_key):
            return frozendict({
                k: v if k == 'id' else v or False  # NewId are Falsy
                for k, v in grouping_key.items()
            })

        def sanitize_update_values(update_values):
            update_values['move_id'] = self.id
            if display_type:
                update_values['display_type'] = display_type
            return update_values

        display_type = values.get('display_type')
        sync = values['sync_display_type']
        force_update_fields = values.get('force_update_fields', set())

        if display_type:
            candidates = self.line_ids.filtered(lambda line: line.display_type == display_type)
            update_by_id = False
        else:
            ids = {x['id'] for x in sync.keys()}
            candidates = self.line_ids.filtered(lambda line: line.id in ids)
            update_by_id = True

        if not sync:
            return [Command.unlink(line.id) for line in candidates]

        field_names = next(iter(sync.keys())).keys()
        candidates_per_grouping_key = {}
        for candidate in candidates:
            candidates_per_grouping_key\
                .setdefault(sanitize_grouping_key(self._build_line_grouping_key(candidate, field_names)), [])\
                .append(candidate)

        line_ids_commands = []
        for grouping_key, to_update in sync.items():
            grouping_key = sanitize_grouping_key(grouping_key)
            to_update = sanitize_update_values(to_update)
            if candidates := candidates_per_grouping_key.get(grouping_key):
                candidate = candidates[0]
                to_update = self.env['account.move.line']._sanitize_values_write(candidate, to_update)
                line_ids_commands.append(Command.update(candidate.id, {
                    k: v
                    for k, v in to_update.items()
                    if candidate._fields[k].type == 'monetary' or k in force_update_fields
                }))
                if not update_by_id:
                    for trailing_candidate in candidates[1:]:
                        line_ids_commands.append(Command.unlink(trailing_candidate.id))
                del candidates_per_grouping_key[grouping_key]
            elif not update_by_id:
                to_update = self.env['account.move.line']._sanitize_values_create(self, to_update)
                line_ids_commands.append(Command.create({**grouping_key, **to_update}))

        if not update_by_id:
            for _grouping_key, candidates in candidates_per_grouping_key.items():
                for candidate in candidates:
                    line_ids_commands.append(Command.unlink(candidate.id))
        return line_ids_commands

    @api.model
    def _apply_sync_lines_diff(self, sync_lines_diff):
        impacted_lines = self.env['account.move.line']
        if not sync_lines_diff:
            return impacted_lines

        to_create = []
        to_unlink = set()
        for move, values in sync_lines_diff.items():
            is_onchange_mode = not move.id
            onchange_commands = []

            for create_values in values['create']:
                if is_onchange_mode:
                    onchange_commands.append(Command.create(create_values))
                else:
                    to_create.append(create_values)
            for line_id, update_values in values['update'].items():
                if is_onchange_mode:
                    onchange_commands.append(Command.update(line_id, update_values))
                else:
                    line = impacted_lines.browse(line_id)
                    line.write(update_values)
                    impacted_lines |= line
            for line_id in values['unlink']:
                if is_onchange_mode:
                    onchange_commands.append(Command.unlink(line_id))
                else:
                    to_unlink.add(line_id)

            if onchange_commands:
                move.line_ids = onchange_commands
                impacted_lines |= move.line_ids

        if to_create:
            impacted_lines |= impacted_lines.create(to_create)
        if to_unlink:
            impacted_lines.browse(to_unlink).with_context(dynamic_unlink=True).unlink()
        return impacted_lines

    @api.model
    def _update_moves_per_batch(self, values_per_move):
        impacted_lines = self.env['account.move.line']
        if not values_per_move:
            return impacted_lines

        to_create = []
        to_unlink = set()
        for move, values in values_per_move.items():
            line_ids_commands = move._convert_sync_values_to_line_ids_commands(values)

            # print("-------------------------------------------------------------------------------")
            # for c in line_ids_commands:
            #     import pprint
            #     print(pprint.pformat(c))

            # In an onchange, there is only one record and we can't use the 'create'
            # so let's apply the changes directly.
            if not move.id:
                move.line_ids = line_ids_commands
                impacted_lines |= move.line_ids
                continue

            for command in line_ids_commands:
                if command[0] == Command.UPDATE:
                    line = impacted_lines.browse(command[1])
                    line.write(command[2])
                    impacted_lines |= line
                elif command[0] == Command.CREATE:
                    to_create.append(command[2])
                elif command[0] == Command.UNLINK:
                    to_unlink.add(command[1])

        if to_create:
            impacted_lines |= impacted_lines.create(to_create)
        if to_unlink:
            impacted_lines.browse(to_unlink).with_context(dynamic_unlink=True).unlink()
        return impacted_lines

    # -------------------------------------------------------------------------
    # DYNAMIC LINES: quick encoding (add new line)
    # -------------------------------------------------------------------------

    def _quick_encoding_dirty(self, move_container, lines_container):
        self.ensure_one()
        return (
            self.state == 'draft'
            and self.is_invoice(include_receipts=True)
            and not self.line_ids
            and self.quick_edit_total_amount
            and self.quick_edit_mode
            and self.quick_encoding_vals
        ), {}

    def _prepare_quick_encoding_lines(self, sync_values):
        self.ensure_one()
        suggestions = self.quick_encoding_vals
        sync_values['create'].append({
            'display_type': 'product',
            'partner_id': self.partner_id.id,
            'account_id': suggestions['account_id'],
            'currency_id': self.currency_id.id,
            'price_unit': suggestions['price_unit'],
            'tax_ids': [Command.set(suggestions['tax_ids'])],
        })

    @api.model
    def _sync_quick_encoding_lines(self, move_container, lines_container):
        self._sync_lines(
            move_container,
            lines_container,
            lambda move: move._quick_encoding_dirty(move_container, lines_container),
            lambda move, sync_values: move._prepare_quick_encoding_lines(sync_values),
        )

    # -------------------------------------------------------------------------
    # DYNAMIC LINES: prepare the taxes computation
    # -------------------------------------------------------------------------

    def _get_base_lines_for_taxes_computation(self, product=True, epd=False, cash_rounding=False):
        self.ensure_one()
        is_invoice = self.is_invoice(include_receipts=True)
        if is_invoice:
            display_types = set()
            if product:
                display_types.add('product')
            if epd:
                display_types.add('epd')
            if cash_rounding:
                display_types.add('cash_rounding')
            amls = self.line_ids.filtered(lambda line: line.display_type in display_types)
        else:
            amls = self.line_ids.filtered('tax_ids')
        base_lines = []
        for line in amls:
            base_lines.append(line._convert_to_tax_base_line_dict())

        return base_lines

    @api.model
    def _get_move_common_fields_sync_taxes(self):
        return {'move_type', 'date'}

    @api.model
    def _get_move_invoice_fields_sync_taxes(self):
        return self._get_move_common_fields_sync_taxes().union({'invoice_date'})

    @api.model
    def _prepare_product_tax_details_per_move(self, move_container, lines_container):
        product_tax_details_per_move = {}
        for move in move_container['records']:
            if move.state != 'draft':
                continue

            # In case of manual changes of tax lines, don't recompute them.
            if self._field_has_changed(
                container=lines_container,
                field_names={'amount_currency', 'balance'},
                domain=[('display_type', '=', 'tax')],
            ):
                continue

            # Collect the base lines. For an invoice, it's the invoice lines. For a misc. entry, it's all lines.
            # Depending on some fields touched in the move, we don't want to recompute the taxes. For example, when changing the date,
            # only the rate will be updated but the custom tax amounts stay untouched.
            is_invoice = move.is_invoice(include_receipts=True)
            if is_invoice:
                dirty_field_names = move.line_ids._get_invoice_line_fields_sync_taxes()
                preserve_foreign_amount_field_names = self._get_move_invoice_fields_sync_taxes()
            else:
                dirty_field_names = move.line_ids._get_misc_line_fields_sync_taxes()
                preserve_foreign_amount_field_names = self._get_move_common_fields_sync_taxes()

            base_lines = move.line_ids.filtered(lambda line: line.display_type == 'product')
            is_dirty = (
                self._field_has_changed(lines_container, dirty_field_names, records=base_lines)
                or self._record_has_been_removed(lines_container, move, display_types={'product'})
            )
            preserve_tax_amounts = False
            if not is_dirty:
                preserve_tax_amounts = self._field_has_changed(move_container, preserve_foreign_amount_field_names, records=move)
                if preserve_tax_amounts:
                    is_dirty = True

            if not is_dirty:
                continue

            # Compute the taxes.
            product_tax_details_per_move[move] = self.env['account.tax']._compute_taxes(
                base_lines=[line._convert_to_tax_base_line_dict() for line in base_lines],
                company=move.company_id,
                include_caba_tags=move.always_tax_exigible,
            )
            product_tax_details_per_move[move]['preserve_tax_amounts'] = preserve_tax_amounts
        return product_tax_details_per_move

    # -------------------------------------------------------------------------
    # DYNAMIC LINES: update accounting fields for base lines
    # -------------------------------------------------------------------------

    def _product_lines_dirty(self, move_container, lines_container, product_tax_details):
        self.ensure_one()
        return bool(product_tax_details), {}

    def _prepare_product_lines(self, sync_values, product_tax_details):
        self.ensure_one()
        for base_line, to_update in product_tax_details['base_lines_to_update']:
            line = base_line['record']
            price_subtotal = to_update['price_subtotal']
            if base_line['rate']:
                balance = self.company_currency_id.round(price_subtotal * self.direction_sign / base_line['rate'])
            else:
                balance = 0.0
            to_sync = {
                'tax_tag_ids': to_update['tax_tag_ids'],
                'amount_currency': price_subtotal * self.direction_sign,
                'balance': balance,
            }
            if self.is_invoice(include_receipts=True):
                to_sync['price_subtotal'] = to_update['price_subtotal']
                to_sync['price_total'] = to_update['price_total']
            sync_values['update'][line.id] = to_sync

    @api.model
    def _sync_product_lines(self, move_container, lines_container, product_tax_details_per_move):
        self._sync_lines(
            move_container,
            lines_container,
            lambda move: move._product_lines_dirty(move_container, lines_container, product_tax_details_per_move.get(move)),
            lambda move, sync_values: move._prepare_product_lines(sync_values, product_tax_details_per_move.get(move)),
        )

    # -------------------------------------------------------------------------
    # DYNAMIC LINES: early payment discount
    # -------------------------------------------------------------------------

    @api.model
    def _get_invoice_fields_sync_epd(self):
        return {'move_type', 'invoice_payment_term_id'}

    def _epd_lines_dirty(self, move_container, lines_container, product_tax_details):
        self.ensure_one()
        return (
            self.state == 'draft'
            and self.is_invoice(include_receipts=True)
            and (
                product_tax_details
                or self._field_has_changed(
                    container=move_container,
                    field_names=self._get_invoice_fields_sync_epd(),
                    records=self,
                )
                or self._record_has_been_removed(lines_container, self, display_types={'product'})
            )
        ), {}

    def _prepare_epd_lines(self, sync_values):
        self.ensure_one()
        payment_term = self.invoice_payment_term_id
        discount_percentage = payment_term.discount_percentage
        early_pay_discount_computation = payment_term.early_pay_discount_computation
        if not discount_percentage or early_pay_discount_computation != 'mixed':
            return

        discount_percentage_name = f"{discount_percentage}%"
        percentage = discount_percentage / 100
        for line in self.line_ids.filtered(lambda line: line.display_type == 'product'):
            if not line.tax_ids:
                continue

            taxes = line.tax_ids.filtered(lambda t: t.amount_type != 'fixed')
            amount_currency = line.currency_id.round(line['amount_currency'] * percentage)
            balance = line.company_currency_id.round(line['balance'] * percentage)
            common_key = {
                'account_id': line.account_id.id,
                'currency_id': line.currency_id.id,
                'partner_id': line.partner_id.id,
            }
            values = sync_values['grouping_keys'].setdefault(
                frozendict({
                    **common_key,
                    'analytic_distribution': line.analytic_distribution,
                    'tax_ids': [Command.set(taxes.ids)],
                }),
                {
                    'name': _("Early Payment Discount (%s)", discount_percentage_name),
                    'amount_currency': 0.0,
                    'balance': 0.0,
                },
            )
            values['amount_currency'] -= amount_currency
            values['balance'] -= balance

            values = sync_values['grouping_keys'].setdefault(
                frozendict({
                    **common_key,
                    'analytic_distribution': False,
                    'tax_ids': [Command.set([])],
                }),
                {
                    'name': _("Early Payment Discount (%s)", discount_percentage_name),
                    'amount_currency': 0.0,
                    'balance': 0.0,
                },
            )
            values['amount_currency'] += amount_currency
            values['balance'] += balance

    @api.model
    def _sync_epd_lines(self, move_container, lines_container, product_tax_details_per_move):
        self._sync_lines_from_display_type(
            move_container,
            lines_container,
            'epd',
            lambda move: move._epd_lines_dirty(move_container, lines_container, product_tax_details_per_move.get(move)),
            lambda move, sync_values: move._prepare_epd_lines(sync_values),
        )

    @api.model
    def _prepare_epd_tax_details_per_move(self, container):
        epd_tax_details_per_move = {}
        for move in container['records']:
            if move.state != 'draft':
                continue

            base_lines = move._get_base_lines_for_taxes_computation(epd=True, product=False)
            if not base_lines:
                continue

            epd_tax_details_per_move[move] = self.env['account.tax']._compute_taxes(
                base_lines,
                move.company_id,
                include_caba_tags=move.always_tax_exigible,
            )
        return epd_tax_details_per_move

    # -------------------------------------------------------------------------
    # DYNAMIC LINES: tax lines
    # -------------------------------------------------------------------------

    def _tax_lines_dirty(self, move_container, lines_container, product_tax_details, epd_tax_details):
        self.ensure_one()
        return self.state == 'draft' and product_tax_details and not product_tax_details['preserve_tax_amounts'], {}

    def _tax_lines_dirty_preserve_tax_amounts(self, move_container, lines_container, product_tax_details, epd_tax_details):
        self.ensure_one()
        return self.state == 'draft' and product_tax_details and product_tax_details['preserve_tax_amounts'], {}

    def _prepare_tax_lines(self, sync_values, product_tax_details, epd_tax_details):
        self.ensure_one()
        epd_tax_details = epd_tax_details or {}
        for tax_lines_to_add in (product_tax_details['tax_lines_to_add'], epd_tax_details.get('tax_lines_to_add', [])):
            for grouping_key, tax_data in tax_lines_to_add:
                tax = self.env['account.tax.repartition.line'].browse(grouping_key['tax_repartition_line_id']).tax_id
                grouping_key = frozendict(grouping_key)
                values = sync_values['grouping_keys'].setdefault(grouping_key, {
                    'name': tax.name,
                    'amount_currency': 0.0,
                    'balance': 0.0,
                    'tax_base_amount': 0.0,
                })
                values['amount_currency'] += tax_data['tax_amount_currency'] * self.direction_sign
                values['balance'] += tax_data['tax_amount'] * self.direction_sign
                values['tax_base_amount'] += tax_data['base_amount']

        # Remove tax lines having a total of zero.
        for grouping_key, values in list(sync_values['grouping_keys'].items()):
            currency = self.env['res.currency'].browse(grouping_key['currency_id'])
            if currency.is_zero(values['amount_currency']) and self.company_currency_id.is_zero(values['balance']):
                del sync_values['grouping_keys'][grouping_key]

    def _prepare_tax_lines_preserve_tax_amounts(self, sync_values):
        self.ensure_one()
        for tax_line in self.line_ids.filtered('tax_repartition_line_id'):
            rate = tax_line.currency_rate
            sync_values['update'][tax_line.id] = {
                'balance': self.company_currency_id.round(tax_line.amount_currency / rate) if rate else 0.0,
            }

    @api.model
    def _sync_tax_lines(self, move_container, lines_container, product_tax_details_per_move, epd_tax_details_per_move):
        self._sync_lines_from_display_type(
            move_container,
            lines_container,
            'tax',
            lambda move: move._tax_lines_dirty(
                move_container,
                lines_container,
                product_tax_details_per_move.get(move),
                epd_tax_details_per_move.get(move),
            ),
            lambda move, sync_values: move._prepare_tax_lines(
                sync_values,
                product_tax_details_per_move.get(move),
                epd_tax_details_per_move.get(move),
            ),
        )
        self._sync_lines(
            move_container,
            lines_container,
            lambda move: move._tax_lines_dirty_preserve_tax_amounts(
                move_container,
                lines_container,
                product_tax_details_per_move.get(move),
                epd_tax_details_per_move.get(move),
            ),
            lambda move, sync_values: move._prepare_tax_lines_preserve_tax_amounts(sync_values),
        )

    # -------------------------------------------------------------------------
    # DYNAMIC LINES: quick encoding (post-fix the tax amounts)
    # -------------------------------------------------------------------------

    def _quick_encoding_fix_total_amount_dirty(self, move_container, lines_container):
        self.ensure_one()
        sign = self.direction_sign
        lines = self.line_ids.filtered(lambda line: line.display_type in ('product', 'epd', 'rounding', 'tax'))
        total_amount = sign * sum(lines.mapped('amount_currency'))
        invoice_lines = self.line_ids.filtered(lambda line: line.display_type == 'product')
        delta_amount_currency = self.quick_edit_total_amount - total_amount
        return (
            self.state == 'draft'
            and self.is_invoice(include_receipts=True)
            and self.quick_encoding_vals
            and self.quick_edit_total_amount
            and self.quick_edit_mode
            and invoice_lines
            and all(set(invoice_line.tax_ids.ids) == set(self.quick_encoding_vals['tax_ids']) for invoice_line in invoice_lines)
            and 0.0 < abs(delta_amount_currency) <= (self.currency_id.rounding * 2)
        ), {'delta_amount_currency': delta_amount_currency}

    def _prepare_quick_encoding_fix_total_amount(self, sync_values):
        self.ensure_one()
        delta_amount_currency = sync_values['dirty']['delta_amount_currency']
        sign = self.direction_sign
        rate = self.invoice_currency_rate
        tax_line = self.line_ids \
            .filtered(lambda line: line.display_type == 'tax') \
            .sorted(key=lambda line: sign * line.amount_currency)[:1]
        amount_currency = tax_line.amount_currency + (sign * delta_amount_currency)
        balance = self.company_currency_id.round(amount_currency / rate) if rate else 0.0
        sync_values['update'][tax_line.id] = {
            'amount_currency': amount_currency,
            'balance': balance,
        }

    @api.model
    def _sync_quick_encoding_lines_fix_total_amount(self, move_container, lines_container):
        self._sync_lines(
            move_container,
            lines_container,
            lambda move: move._quick_encoding_fix_total_amount_dirty(move_container, lines_container),
            lambda move, sync_values: move._prepare_quick_encoding_fix_total_amount(sync_values),
        )

    # -------------------------------------------------------------------------
    # DYNAMIC LINES: discount lines
    # -------------------------------------------------------------------------

    @api.model
    def _get_invoice_fields_sync_discount(self):
        return {'company_id', 'currency_id'}

    def _discount_lines_dirty(self, move_container, lines_container):
        self.ensure_one()
        invoice_lines = self.line_ids.filtered(lambda line: line.display_type == 'product')
        discount_allocation_account = self._get_discount_allocation_account()
        return (
            self.state == 'draft'
            and self.is_invoice(include_receipts=True)
            and discount_allocation_account
            and (
                self._field_has_changed(
                    container=move_container,
                    field_names=self._get_invoice_fields_sync_discount(),
                    records=self,
                )
                or self._field_has_changed(
                    container=lines_container,
                    field_names=self.env['account.move.line']._get_invoice_line_fields_sync_discount(),
                    records=invoice_lines,
                )
                or self._record_has_been_removed(lines_container, self, display_types={'product'})
            )
        ), {}

    def _prepare_discount_lines(self, sync_values):
        self.ensure_one()
        discount_allocation_account = self._get_discount_allocation_account()
        invoice_lines = self.line_ids.filtered(lambda line: line.display_type == 'product' and line.discount)
        rate = self.invoice_currency_rate
        for line in invoice_lines:
            raw_amount_currency = line.move_id.direction_sign * line.quantity * line.price_unit * line.discount / 100
            amount_currency = line.currency_id.round(raw_amount_currency)
            balance = line.company_currency_id.round(amount_currency / rate) if rate else 0.0
            values = sync_values['grouping_keys'].setdefault(
                frozendict({
                    'account_id': line.account_id.id,
                    'currency_id': line.currency_id.id,
                }),
                {
                    'name': _("Discount"),
                    'amount_currency': 0.0,
                    'balance': 0.0,
                },
            )
            values['amount_currency'] += amount_currency
            values['balance'] += balance

            values = sync_values['grouping_keys'].setdefault(
                frozendict({
                    'account_id': discount_allocation_account.id,
                    'currency_id': line.currency_id.id,
                }),
                {
                    'name': _("Discount"),
                    'amount_currency': 0.0,
                    'balance': 0.0,
                },
            )
            values['amount_currency'] -= amount_currency
            values['balance'] -= balance

    @api.model
    def _sync_discount_lines(self, move_container, lines_container):
        self._sync_lines_from_display_type(
            move_container,
            lines_container,
            'discount',
            lambda move: move._discount_lines_dirty(move_container, lines_container),
            lambda move, sync_values: move._prepare_discount_lines(sync_values),
        )

    # -------------------------------------------------------------------------
    # DYNAMIC LINES: cash rounding
    # -------------------------------------------------------------------------

    @api.model
    def _get_invoice_fields_sync_cash_rounding(self):
        return {'move_type', 'invoice_cash_rounding_id'}

    @api.model
    def _sync_cash_rounding_lines(self, move_container, lines_container):
        sync_cash_rounding_lines = {}
        for move in move_container['records']:
            is_invoice = move.is_invoice(include_receipts=True)
            if not is_invoice or move.state != 'draft':
                continue

            base_lines = move.line_ids.filtered(lambda line: line.display_type in ('product', 'epd'))
            tax_lines = move.line_ids.filtered('tax_repartition_line_id')
            all_lines = base_lines + tax_lines
            is_dirty = (
                self._field_has_changed(move_container, self._get_invoice_fields_sync_cash_rounding(), records=move)
                or self._record_has_been_removed(lines_container, move)
                or self._field_has_changed(lines_container, move.line_ids._get_invoice_line_fields_sync_cash_rounding(), records=all_lines)
            )
            if not is_dirty:
                continue

            cash_rounding = move.invoice_cash_rounding_id
            if not cash_rounding:
                sync_cash_rounding_lines[move] = {'sync_display_type': {}, 'display_type': 'rounding'}
                continue

            base_amount_currency = 0.0
            tax_amount_currency = 0.0
            sign = move.direction_sign
            for line in base_lines:
                base_amount_currency += sign * line.amount_currency
            for line in tax_lines:
                tax_amount_currency += sign * line.amount_currency

            expected_total = float_round(
                base_amount_currency + tax_amount_currency,
                precision_rounding=cash_rounding.rounding,
                rounding_method=cash_rounding.rounding_method,
            )
            currency = move.currency_id
            difference = currency.round(expected_total - base_amount_currency - tax_amount_currency)
            sync_cash_rounding_lines = {}
            if not currency.is_zero(difference):
                strategy = cash_rounding.strategy
                rate = move.invoice_currency_rate
                if strategy == 'add_invoice_line':
                    account = cash_rounding.loss_account_id if difference < 0.0 else cash_rounding.profit_account_id
                    sync_cash_rounding_lines[move] = {
                        'sync_display_type': {
                            frozendict({
                                'partner_id': move.commercial_partner_id.id,
                                'currency_id': move.currency_id.id,
                                'account_id': account.id,
                                'tax_ids': [Command.set([])],
                            }): {
                                'name': move.invoice_cash_rounding_id.name,
                                'amount_currency': sign * difference,
                                'balance': sign * move.company_currency_id.round(difference / rate) if rate else 0.0,
                            },
                        },
                        'display_type': 'rounding',
                    }
                elif strategy == 'biggest_tax':
                    tax_line = move.line_ids\
                        .filtered(lambda line: line.display_type == 'tax')\
                        .sorted(key=lambda line: move.direction_sign * line.amount_currency)[:1]
                    difference_balance = move.company_currency_id.round(difference / rate) if rate else 0.0
                    sync_cash_rounding_lines[move] = {
                        'sync_display_type': {
                            frozendict({'id': tax_line.id}): {
                                'amount_currency': tax_line.amount_currency + (sign * difference),
                                'balance': tax_line.balance + (sign * difference_balance),
                            },
                        },
                    }
        return sync_cash_rounding_lines

    # -------------------------------------------------------------------------
    # DYNAMIC LINES: payment terms
    # -------------------------------------------------------------------------

    @api.model
    def _get_invoice_fields_sync_payment_term(self):
        return {'move_type', 'invoice_payment_term_id', 'invoice_date_due', 'state'}

    def _fetch_invoice_term_line_most_frequent_account(self):
        self.env.cr.execute("""
            WITH properties AS(
                SELECT DISTINCT ON (property.company_id, property.name, property.res_id)
                       'res.partner' AS model,
                       SPLIT_PART(property.res_id, ',', 2)::integer AS id,
                       CASE
                           WHEN property.name = 'property_account_receivable_id' THEN 'asset_receivable'
                           ELSE 'liability_payable'
                       END AS account_type,
                       SPLIT_PART(property.value_reference, ',', 2)::integer AS account_id
                  FROM ir_property property
                  JOIN res_company company ON property.company_id = company.id
                 WHERE property.name IN ('property_account_receivable_id', 'property_account_payable_id')
                   AND property.company_id = ANY(%(company_ids)s)
                   AND property.res_id = ANY(%(partners)s)
              ORDER BY property.company_id, property.name, property.res_id, account_id
            ),
            default_properties AS(
                SELECT DISTINCT ON (property.company_id, property.name)
                       'res.partner' AS model,
                       company.partner_id AS id,
                       CASE
                           WHEN property.name = 'property_account_receivable_id' THEN 'asset_receivable'
                           ELSE 'liability_payable'
                       END AS account_type,
                       SPLIT_PART(property.value_reference, ',', 2)::integer AS account_id
                  FROM ir_property property
                  JOIN res_company company ON property.company_id = company.id
                 WHERE property.name IN ('property_account_receivable_id', 'property_account_payable_id')
                   AND property.company_id = ANY(%(company_ids)s)
                   AND property.res_id IS NULL
              ORDER BY property.company_id, property.name, account_id
            ),
            fallback AS (
                SELECT DISTINCT ON (account.company_id, account.account_type)
                       'res.company' AS model,
                       account.company_id AS id,
                       account.account_type AS account_type,
                       account.id AS account_id
                  FROM account_account account
                 WHERE account.company_id = ANY(%(company_ids)s)
                   AND account.account_type IN ('asset_receivable', 'liability_payable')
                   AND account.deprecated = 'f'
            )
            SELECT * FROM default_properties
            UNION ALL
            SELECT * FROM properties
            UNION ALL
            SELECT * FROM fallback
        """, {
            'company_ids': self.company_id.ids,
            'partners': [f'res.partner,{pid}' for pid in self.commercial_partner_id.ids],
        })
        accounts = {
            (model, id, account_type): account_id
            for model, id, account_type, account_id in self.env.cr.fetchall()
        }
        results = {}
        for invoice in self:
            account_type = 'asset_receivable' if invoice.is_sale_document(include_receipts=True) else 'liability_payable'
            account_id = (
                accounts.get(('res.partner', invoice.commercial_partner_id.id, account_type))
                or accounts.get(('res.partner', invoice.company_id.partner_id.id, account_type))
                or accounts.get(('res.company', invoice.company_id.id, account_type))
            )
            if not account_id:
                continue

            if invoice.fiscal_position_id:
                account_id = invoice.fiscal_position_id.map_account(self.env['account.account'].browse(account_id)).id

            results[invoice] = account_id
        return results

    def _payment_term_lines_dirty_draft(self, move_container, lines_container):
        self.ensure_one()
        display_types = {'product', 'epd', 'rounding', 'tax'}
        extra_values = {
            'has_invoice_partner_field_changed': self._field_has_changed(
                container=move_container,
                field_names={'partner_id'},
                records=self,
            ),
            'has_invoice_just_been_created': self._record_has_been_created(move_container, self),
        }
        return (
            self.state == 'draft'
            and self.is_invoice(include_receipts=True)
            and (
                self._field_has_changed(
                    container=move_container,
                    field_names=self._get_invoice_fields_sync_payment_term(),
                    records=self,
                )
                or self._field_has_changed(
                    container=lines_container,
                    field_names=self.env['account.move.line']._get_invoice_line_fields_sync_payment_term(),
                    records=self.line_ids.filtered(lambda line: line.display_type in display_types),
                )
                or self._record_has_been_removed(lines_container, self, display_types=display_types)
            )
        ), extra_values

    def _payment_term_lines_dirty_posted(self, move_container, lines_container):
        self.ensure_one()
        return (
            self.state != 'draft'
            and self.is_invoice(include_receipts=True)
            and (
                self._field_has_changed(
                    container=move_container,
                    field_names={'state'},
                    records=self,
                )
            )
        ), {}

    def _prepare_payment_term_lines_draft(self, sync_values, get_most_frequent_accounts_function):
        self.ensure_one()
        has_invoice_partner_field_changed = sync_values['dirty']['has_invoice_partner_field_changed']
        has_invoice_just_been_created = sync_values['dirty']['has_invoice_just_been_created']

        # Compute the 'account_id'.
        term_lines = self.line_ids \
            .filtered(lambda line: line.display_type == 'payment_term') \
            .sorted('date_maturity')
        if (
            term_lines
            and (not has_invoice_partner_field_changed or has_invoice_just_been_created)
        ):
            # Keep the existing account if the invoice has been created with existing term lines like a duplicate.
            # However, if the user manually changes the partner set on the invoice, in that case, let's recompute the
            # account from the configuration.
            account_id = term_lines[0].account_id.id
        else:
            account_id = get_most_frequent_accounts_function()
        if not account_id:
            return

        # Compute the base and tax amounts.
        base_lines = self.line_ids.filtered(lambda line: line.display_type in ('product', 'epd', 'rounding'))
        if not base_lines:
            return

        tax_lines = self.line_ids.filtered('tax_repartition_line_id')
        base_amount_currency = 0.0
        base_amount = 0.0
        tax_amount_currency = 0.0
        tax_amount = 0.0
        sign = self.direction_sign
        for line in base_lines:
            base_amount_currency += sign * line.amount_currency
            base_amount += sign * line.balance
        for line in tax_lines:
            tax_amount_currency += sign * line.amount_currency
            tax_amount += sign * line.balance

        # Compute the label.
        term_line_name = self.payment_reference or ''

        if self.invoice_payment_term_id:
            invoice_payment_terms = self.invoice_payment_term_id._compute_terms(
                date_ref=self.invoice_date or self.date or fields.Date.context_today(self),
                currency=self.currency_id,
                tax_amount_currency=tax_amount_currency,
                tax_amount=tax_amount,
                untaxed_amount_currency=base_amount_currency,
                untaxed_amount=base_amount,
                company=self.company_id,
                sign=1,
            )

            need_installment = len(invoice_payment_terms['line_ids']) > 1
            for index, term_line in enumerate(invoice_payment_terms['line_ids'], start=1):
                if need_installment:
                    name = _('%(name)s installment #%(number)s', name=term_line_name, number=index).lstrip()
                else:
                    name = term_line_name

                sync_values['grouping_keys'][
                    frozendict({
                        'date_maturity': fields.Date.to_date(term_line.get('date')),
                        'currency_id': self.currency_id.id,
                        'account_id': account_id,
                        'discount_date': invoice_payment_terms.get('discount_date'),
                    })
                ] = {
                    'name': name,
                    'balance': -sign * term_line['company_amount'],
                    'amount_currency': -sign * term_line['foreign_amount'],
                    'discount_balance': -sign * (invoice_payment_terms.get('discount_balance') or 0.0),
                    'discount_amount_currency': -sign * (invoice_payment_terms.get('discount_amount_currency') or 0.0),
                }
        else:
            sync_values['grouping_keys'][
                frozendict({
                    'date_maturity': fields.Date.to_date(self.invoice_date_due or self.date),
                    'currency_id': self.currency_id.id,
                    'account_id': account_id,
                    'discount_date': False,
                })
            ] = {
                'name': term_line_name,
                'amount_currency': -sign * (base_amount_currency + tax_amount_currency),
                'balance': -sign * (base_amount + tax_amount),
                'discount_balance': 0.0,
                'discount_amount_currency': 0.0,
            }

    def _prepare_payment_term_lines_posted(self, sync_values):
        self.ensure_one()
        term_lines = self.line_ids \
            .filtered(lambda line: line.display_type == 'payment_term') \
            .sorted('date_maturity')
        term_line_name = self.payment_reference or self.name or ''
        need_installment = len(term_lines) > 1
        for index, term_line in enumerate(term_lines, start=1):
            if need_installment:
                name = _('%(name)s installment #%(number)s', name=term_line_name, number=index).lstrip()
            elif not term_line.name:
                name = term_line_name
            else:
                continue
            sync_values['update'][term_line.id] = {'name': name}

    @api.model
    def _sync_payment_term_lines(self, move_container, lines_container):
        most_frequent_accounts = {}

        def get_most_frequent_accounts_function(move, most_frequent_accounts):
            if not most_frequent_accounts:
                most_frequent_accounts.update(move_container['records']._fetch_invoice_term_line_most_frequent_account())
            return most_frequent_accounts.get(move)

        self._sync_lines_from_display_type(
            move_container,
            lines_container,
            'payment_term',
            lambda move: move._payment_term_lines_dirty_draft(move_container, lines_container),
            lambda move, sync_values: move._prepare_payment_term_lines_draft(
                sync_values,
                lambda: get_most_frequent_accounts_function(move, most_frequent_accounts),
            ),
        )
        self._sync_lines(
            move_container,
            lines_container,
            lambda move: move._payment_term_lines_dirty_posted(move_container, lines_container),
            lambda move, sync_values: move._prepare_payment_term_lines_posted(sync_values),
        )

    # -------------------------------------------------------------------------
    # DYNAMIC LINES: update date_maturity based on term lines
    # -------------------------------------------------------------------------

    @api.model
    def _sync_date_maturity(self, move_container, lines_container):
        sync_date_maturity = {}
        for move in move_container['records']:
            term_lines = move.line_ids\
                .filtered(lambda line: line.display_type == 'payment_term')\
                .sorted('date_maturity', reverse=True)
            is_dirty = self._field_has_changed(lines_container, term_lines._get_invoice_line_fields_sync_date_maturity(), records=term_lines)
            if not is_dirty or not term_lines:
                continue

            sync_date_maturity[move] = {'invoice_date_due': term_lines[0].date_maturity}
        return sync_date_maturity

    # -------------------------------------------------------------------------
    # DYNAMIC LINES: auto balancing of misc. journal entries.
    # -------------------------------------------------------------------------

    @api.model
    def _sync_unbalanced_lines(self, move_container, lines_container, product_tax_details_per_move):
        sync_unbalanced_lines = {}
        for move in move_container['records']:
            if move.state != 'draft' or not move.is_entry():
                continue

            sync_move_values = sync_unbalanced_lines.setdefault(move, {'sync_display_type': {}, 'display_type': 'misc_auto_balance'})['sync_display_type']

            # Only manage automatically unbalanced when taxes are involved.
            if move not in product_tax_details_per_move:
                continue

            total_balance = sum(move.line_ids.filtered(lambda line: line.display_type != 'misc_auto_balance').mapped('balance'))
            if (
                move.company_id.account_journal_suspense_account_id
                and not move.company_currency_id.is_zero(total_balance)
            ):
                rate = self.env['res.currency']._get_conversion_rate(
                    from_currency=move.company_currency_id,
                    to_currency=move.currency_id,
                    company=move.company_id,
                    date=move.date or move.context_today(move),
                )
                sync_move_values[
                    frozendict({
                        'currency_id': move.currency_id.id,
                        'account_id': move.company_id.account_journal_suspense_account_id.id,
                    })
                ] = {
                    'name': _("Automatic Balancing Line"),
                    'balance': total_balance,
                    'amount_currency': move.currency_id.round(total_balance * rate),
                }
        return sync_unbalanced_lines

    # -------------------------------------------------------------------------
    # DYNAMIC LINES: ONCHANGE
    # -------------------------------------------------------------------------

    def _onchange_after_update_cache_hook(self, changed_values):
        # EXTENDS 'web'
        super()._onchange_after_update_cache_hook(changed_values)

        move_container = {'records': self}
        lines_container = {'records': self.line_ids}
        data_pre_yield = self._sync_dynamic_lines_pre_yield(move_container, lines_container)
        for field_name, values in changed_values.items():
            if field_name in move_container['data_before'][self]:
                move_container['data_before'][self][field_name] = None
            elif field_name == 'line_ids':
                by_virtual_id = {}
                by_id = {}
                for command in values:
                    if command[0] == Command.CREATE and command[2].get('last_onchange_fields'):
                        by_virtual_id[command[1]] = ast.literal_eval(command[2]['last_onchange_fields'])
                    elif command[0] == Command.UPDATE:
                        if command[2].get('last_onchange_fields'):
                            by_id[command[1]] = ast.literal_eval(command[2]['last_onchange_fields'])

                has_something_to_update = False
                for record in self.line_ids:
                    if record.id in by_id:
                        to_update = by_id[record.id]
                        has_something_to_update = True
                    elif record.id.origin in by_id:
                        to_update = by_id[record.id.origin]
                        has_something_to_update = True
                    elif record.id.ref in by_virtual_id:
                        to_update = by_virtual_id[record.id.ref]
                        has_something_to_update = True
                    else:
                        continue

                    # A line has been modified/added.
                    for field_name in to_update:
                        if field_name in lines_container['data_before'][record]:
                            lines_container['data_before'][record][field_name] = None

                # A line has been removed.
                if not has_something_to_update:
                    for field_name in lines_container['field_names']:
                        lines_container['changed_field_names'].add(field_name)

        return data_pre_yield

    def _onchange_before_snapshot1_hook(self, pre_data):
        # EXTENDS 'web'
        super()._onchange_before_snapshot1_hook(pre_data)
        pre_data['lines_container']['records'] |= pre_data['move_container']['records'].line_ids
        self._sync_dynamic_lines_after_yield(pre_data)

    def onchange(self, values, field_names, fields_spec):
        # EXTENDS 'web'
        # 'invoice_line_ids' is on the view for the 'hack' but that's it.
        results = super().onchange(values, field_names, fields_spec)
        results['value'].pop('invoice_line_ids', None)

        return results

    # --------------------------------------------------------------------------------------
    # LOW-LEVEL METHODS
    # --------------------------------------------------------------------------------------

    def check_field_access_rights(self, operation, field_names):
        result = super().check_field_access_rights(operation, field_names)
        if not field_names:
            weirdos = ['quick_encoding_vals', 'payment_term_details']
            result = [fname for fname in result if fname not in weirdos]
        return result

    def copy_data(self, default=None):
        default = dict(default or {})
        vals_list = super().copy_data(default)
        default_date = fields.Date.to_date(default.get('date'))
        for move, vals in zip(self, vals_list):
            if move.move_type in ('out_invoice', 'in_invoice'):
                vals['line_ids'] = [
                    (command, _id, line_vals)
                    for command, _id, line_vals in vals['line_ids']
                    if command == Command.CREATE
                ]
            elif move.move_type == 'entry':
                if 'partner_id' not in vals:
                    vals['partner_id'] = False
            user_fiscal_lock_date = move.company_id._get_user_fiscal_lock_date()
            if (default_date or move.date) <= user_fiscal_lock_date:
                vals['date'] = user_fiscal_lock_date + timedelta(days=1)
            if not move.journal_id.active and 'journal_id' in vals:
                del vals['journal_id']
        return vals_list

    def copy(self, default=None):
        default = dict(default or {})
        new_moves = super().copy(default)
        bodies = {}
        for old_move, new_move in zip(self, new_moves):
            message_origin = '' if not new_move.auto_post_origin_id else \
                (Markup('<br/>') + _('This recurring entry originated from %s', new_move.auto_post_origin_id._get_html_link()))
            message_content = _('This entry has been reversed from %s', old_move._get_html_link()) if default.get('reversed_entry_id') else _('This entry has been duplicated from %s', old_move._get_html_link())
            bodies[new_move.id] = message_content + message_origin
        new_moves._message_log_batch(bodies=bodies)
        return new_moves

    def _sanitize_vals(self, vals):
        if vals.get('invoice_line_ids') and vals.get('line_ids'):
            # values can sometimes be in only one of the two fields, sometimes in
            # both fields, sometimes one field can be explicitely empty while the other
            # one is not, sometimes not...
            update_vals = {
                line_id: line_vals[0]
                for command, line_id, *line_vals in vals['invoice_line_ids']
                if command == Command.UPDATE
            }
            for command, line_id, *line_vals in vals['line_ids']:
                if command == Command.UPDATE and line_id in update_vals:
                    line_vals[0].update(update_vals.pop(line_id))
            for line_id, line_vals in update_vals.items():
                vals['line_ids'] += [Command.update(line_id, line_vals)]
            for command, line_id, *line_vals in vals['invoice_line_ids']:
                assert command not in (Command.SET, Command.CLEAR)
                if [command, line_id, *line_vals] not in vals['line_ids']:
                    vals['line_ids'] += [(command, line_id, *line_vals)]
            del vals['invoice_line_ids']
        return vals

    def _get_protected_vals(self, vals, records):
        protected = set()
        for fname in vals:
            field = records._fields.get(fname)
            if field.inverse or (field.compute and not field.readonly):
                protected.update(self.pool.field_computed.get(field, [field]))
        return [(protected, rec) for rec in records]

    @api.model_create_multi
    def create(self, vals_list):
        if any('state' in vals and vals.get('state') == 'posted' for vals in vals_list):
            raise UserError(_('You cannot create a move already in the posted state. Please create a draft move and post it after.'))

        move_container = {'records': self.env['account.move']}
        lines_container = {'records': self.env['account.move.line']}
        with self._check_balanced(move_container):
            with self._sync_dynamic_lines(move_container, lines_container=lines_container):
                for vals in vals_list:
                    self._sanitize_vals(vals)
                move_container['records'] = super().create(vals_list)
                lines_container['records'] = move_container['records'].line_ids
        return move_container['records']

    def write(self, vals):
        if not vals:
            return True

        self._sanitize_vals(vals)
        for move in self:
            violated_fields = set(vals).intersection(move._get_integrity_hash_fields() + ['inalterable_hash'])
            if move.inalterable_hash and violated_fields:
                raise UserError(_(
                    "This document is protected by a hash. "
                    "Therefore, you cannot edit the following fields: %s.",
                    ', '.join(f['string'] for f in self.fields_get(violated_fields).values())
                ))
            if (
                    move.posted_before
                    and 'journal_id' in vals and move.journal_id.id != vals['journal_id']
                    and not (move.name == '/' or not move.name or ('name' in vals and (vals['name'] == '/' or not vals['name'])))
            ):
                raise UserError(_('You cannot edit the journal of an account move if it has been posted once, unless the name is removed or set to "/". This might create a gap in the sequence.'))
            if (
                    move.name and move.name != '/'
                    and move.sequence_number not in (0, 1)
                    and 'journal_id' in vals and move.journal_id.id != vals['journal_id']
                    and not move.quick_edit_mode
                    and not ('name' in vals and (vals['name'] == '/' or not vals['name']))
            ):
                raise UserError(_('You cannot edit the journal of an account move with a sequence number assigned, unless the name is removed or set to "/". This might create a gap in the sequence.'))

            # You can't change the date or name of a move being inside a locked period.
            if move.state == "posted" and (
                    ('name' in vals and move.name != vals['name'])
                    or ('date' in vals and move.date != vals['date'])
            ):
                move._check_fiscalyear_lock_date()
                move.line_ids._check_tax_lock_date()

            # You can't post subtract a move to a locked period.
            if 'state' in vals and move.state == 'posted' and vals['state'] != 'posted':
                move._check_fiscalyear_lock_date()
                move.line_ids._check_tax_lock_date()

            # Disallow modifying readonly fields on a posted move
            move_state = vals.get('state', move.state)
            unmodifiable_fields = (
                'line_ids', 'invoice_date', 'date', 'partner_id', 'partner_bank_id',
                'invoice_payment_term_id', 'currency_id', 'fiscal_position_id', 'invoice_cash_rounding_id')
            readonly_fields = [val for val in vals if val in unmodifiable_fields]
            if not self._context.get('skip_readonly_check') and move_state == "posted" and readonly_fields:
                raise UserError(_("You cannot modify the following readonly fields on a posted move: %s", ', '.join(readonly_fields)))

            if move.journal_id.sequence_override_regex and vals.get('name') and vals['name'] != '/' and not re.match(move.journal_id.sequence_override_regex, vals['name']):
                if not self.env.user.has_group('account.group_account_manager'):
                    raise UserError(_('The Journal Entry sequence is not conform to the current format. Only the Accountant can change it.'))
                move.journal_id.sequence_override_regex = False

        if {'sequence_prefix', 'sequence_number', 'journal_id', 'name'} & vals.keys():
            self._set_next_made_sequence_gap(True)

        move_container = {'records': self}
        lines_container = {'records': self.line_ids}
        with self.env.protecting(self._get_protected_vals(vals, self)), self._check_balanced(move_container):
            with self._sync_dynamic_lines(move_container, lines_container=lines_container):
                res = super(AccountMove, self.with_context(
                    skip_account_move_synchronization=True,
                )).write(vals)
                lines_container['records'] |= self.line_ids

                # Reset the name of draft moves when changing the journal.
                # Protected against holes in the pre-validation checks.
                if 'journal_id' in vals and 'name' not in vals:
                    self.name = False
                    self._compute_name()

                # You can't change the date of a not-locked move to a locked period.
                # You can't post a new journal entry inside a locked period.
                if 'date' in vals or 'state' in vals:
                    posted_move = self.filtered(lambda m: m.state == 'posted')
                    posted_move._check_fiscalyear_lock_date()
                    posted_move.line_ids._check_tax_lock_date()

                if vals.get('state') == 'posted':
                    self.flush_recordset()  # Ensure that the name is correctly computed

                if vals.get('is_move_sent'):
                    self._hash_moves()

            self._synchronize_business_models(set(vals.keys()))

        if 'journal_id' in vals:
            self.line_ids._check_constrains_account_id_journal_id()

        return res

    def check_move_sequence_chain(self):
        return self.filtered(lambda move: move.name != '/')._is_end_of_seq_chain()

    def _get_unlink_logger_message(self):
        """ Before unlink, get a log message for audit trail if it's enabled.
        Logger is added here because in api ondelete, account.move.line is deleted, and we can't get total amount """
        if not self._context.get('force_delete'):
            pass

        moves_details = []
        for move in self.filtered(lambda m: m.posted_before and m.company_id.check_account_audit_trail):
            entry_details = f"{move.name} ({move.id}) amount {move.amount_total} {move.currency_id.name} and partner {move.partner_id.display_name}"
            account_balances_per_account = defaultdict(float)
            for line in move.line_ids:
                account_balances_per_account[line.account_id] += line.balance
            account_details = "\n".join(
                f"- {account.name} ({account.id}) with balance {balance} {move.currency_id.name}"
                for account, balance in account_balances_per_account.items()
            )
            moves_details.append(f"{entry_details}\n{account_details}")

        if moves_details:
            return "\nForce deleted Journal Entries by {user_name} ({user_id})\nEntries\n{moves_details}".format(
                user_name=self.env.user.name,
                user_id=self.env.user.id,
                moves_details="\n".join(moves_details),
            )

    @api.ondelete(at_uninstall=False)
    def _unlink_forbid_parts_of_chain(self):
        """ For a user with Billing/Bookkeeper rights, when the fidu mode is deactivated,
        moves with a sequence number can only be deleted if they are the last element of a chain of sequence.
        If they are not, deleting them would create a gap. If the user really wants to do this, he still can
        explicitly empty the 'name' field of the move; but we discourage that practice.
        If a user is a Billing Administrator/Accountant or if fidu mode is activated, we show a warning,
        but they can delete the moves even if it creates a sequence gap.
        """
        if not (
            self.env.user.has_group('account.group_account_manager')
            or any(self.company_id.mapped('quick_edit_mode'))
            or self._context.get('force_delete')
            or self.check_move_sequence_chain()
        ):
            raise UserError(_(
                "You cannot delete this entry, as it has already consumed a sequence number and is not the last one in the chain. "
                "You should probably revert it instead."
            ))

    @api.ondelete(at_uninstall=False)
    def _unlink_account_audit_trail_except_once_post(self):
        if not self._context.get('force_delete') and any(
                move.posted_before and move.company_id.check_account_audit_trail
                for move in self
        ):
            raise UserError(_(
                "To keep the audit trail, you can not delete journal entries once they have been posted.\n"
                "Instead, you can cancel the journal entry."
            ))

    def unlink(self):
        self._set_next_made_sequence_gap(True)
        self = self.with_context(skip_invoice_sync=True, dynamic_unlink=True)  # no need to sync to delete everything
        logger_message = self._get_unlink_logger_message()
        self.line_ids.unlink()
        res = super().unlink()
        if logger_message:
            _logger.info(logger_message)
        return res

    @api.depends('partner_id', 'date', 'state', 'move_type')
    @api.depends_context('input_full_display_name')
    def _compute_display_name(self):
        for move in self:
            move.display_name = move._get_move_display_name(show_ref=True)

    # -------------------------------------------------------------------------
    # RECONCILIATION METHODS
    # -------------------------------------------------------------------------

    def _collect_tax_cash_basis_values(self):
        ''' Collect all information needed to create the tax cash basis journal entries:
        - Determine if a tax cash basis journal entry is needed.
        - Compute the lines to be processed and the amounts needed to compute a percentage.
        :return: A dictionary:
            * move:                     The current account.move record passed as parameter.
            * to_process_lines:         A tuple (caba_treatment, line) where:
                                            - caba_treatment is either 'tax' or 'base', depending on what should
                                              be considered on the line when generating the caba entry.
                                              For example, a line with tax_ids=caba and tax_line_id=non_caba
                                              will have a 'base' caba treatment, as we only want to treat its base
                                              part in the caba entry (the tax part is already exigible on the invoice)

                                            - line is an account.move.line record being not exigible on the tax report.
            * currency:                 The currency on which the percentage has been computed.
            * total_balance:            sum(payment_term_lines.mapped('balance').
            * total_residual:           sum(payment_term_lines.mapped('amount_residual').
            * total_amount_currency:    sum(payment_term_lines.mapped('amount_currency').
            * total_residual_currency:  sum(payment_term_lines.mapped('amount_residual_currency').
            * is_fully_paid:            A flag indicating the current move is now fully paid.
        '''
        self.ensure_one()

        values = {
            'move': self,
            'to_process_lines': [],
            'total_balance': 0.0,
            'total_residual': 0.0,
            'total_amount_currency': 0.0,
            'total_residual_currency': 0.0,
        }

        currencies = set()
        has_term_lines = False
        for line in self.line_ids:
            if line.account_type in ('asset_receivable', 'liability_payable'):
                sign = 1 if line.balance > 0.0 else -1

                currencies.add(line.currency_id)
                has_term_lines = True
                values['total_balance'] += sign * line.balance
                values['total_residual'] += sign * line.amount_residual
                values['total_amount_currency'] += sign * line.amount_currency
                values['total_residual_currency'] += sign * line.amount_residual_currency

            elif line.tax_line_id.tax_exigibility == 'on_payment':
                values['to_process_lines'].append(('tax', line))
                currencies.add(line.currency_id)

            elif 'on_payment' in line.tax_ids.flatten_taxes_hierarchy().mapped('tax_exigibility'):
                values['to_process_lines'].append(('base', line))
                currencies.add(line.currency_id)

        if not values['to_process_lines'] or not has_term_lines:
            return None

        # Compute the currency on which made the percentage.
        if len(currencies) == 1:
            values['currency'] = list(currencies)[0]
        else:
            # Don't support the case where there is multiple involved currencies.
            return None

        # Determine whether the move is now fully paid.
        values['is_fully_paid'] = self.company_id.currency_id.is_zero(values['total_residual']) \
                                  or values['currency'].is_zero(values['total_residual_currency'])

        return values

    # -------------------------------------------------------------------------
    # SEQUENCE MIXIN
    # -------------------------------------------------------------------------

    def _must_check_constrains_date_sequence(self):
        # OVERRIDES sequence.mixin
        return self.state == 'posted' and not self.quick_edit_mode

    def _get_last_sequence_domain(self, relaxed=False):
        #pylint: disable=sql-injection
        # EXTENDS account sequence.mixin
        self.ensure_one()
        if not self.date or not self.journal_id:
            return "WHERE FALSE", {}
        where_string = "WHERE journal_id = %(journal_id)s AND name != '/'"
        param = {'journal_id': self.journal_id.id}
        is_payment = self.payment_id or self.env.context.get('is_payment')

        if not relaxed:
            domain = [('journal_id', '=', self.journal_id.id), ('id', '!=', self.id or self._origin.id), ('name', 'not in', ('/', '', False))]
            if self.journal_id.refund_sequence:
                refund_types = ('out_refund', 'in_refund')
                domain += [('move_type', 'in' if self.move_type in refund_types else 'not in', refund_types)]
            if self.journal_id.payment_sequence:
                domain += [('payment_id', '!=' if is_payment else '=', False)]
            reference_move_name = self.sudo().search(domain + [('date', '<=', self.date)], order='date desc', limit=1).name
            if not reference_move_name:
                reference_move_name = self.sudo().search(domain, order='date asc', limit=1).name
            sequence_number_reset = self._deduce_sequence_number_reset(reference_move_name)
            date_start, date_end = self._get_sequence_date_range(sequence_number_reset)
            where_string += """ AND date BETWEEN %(date_start)s AND %(date_end)s"""
            param['date_start'] = date_start
            param['date_end'] = date_end
            if sequence_number_reset in ('year', 'year_range'):
                param['anti_regex'] = re.sub(r"\?P<\w+>", "?:", self._sequence_monthly_regex.split('(?P<seq>')[0]) + '$'
            elif sequence_number_reset == 'never':
                param['anti_regex'] = re.sub(r"\?P<\w+>", "?:", self._sequence_yearly_regex.split('(?P<seq>')[0]) + '$'

            if param.get('anti_regex') and not self.journal_id.sequence_override_regex:
                where_string += " AND sequence_prefix !~ %(anti_regex)s "

        if self.journal_id.refund_sequence:
            if self.move_type in ('out_refund', 'in_refund'):
                where_string += " AND move_type IN ('out_refund', 'in_refund') "
            else:
                where_string += " AND move_type NOT IN ('out_refund', 'in_refund') "
        elif self.journal_id.payment_sequence:
            if is_payment:
                where_string += " AND payment_id IS NOT NULL "
            else:
                where_string += " AND payment_id IS NULL "

        return where_string, param

    def _get_starting_sequence(self):
        # EXTENDS account sequence.mixin
        self.ensure_one()
        if self.journal_id.type in ['sale', 'bank', 'cash']:
            starting_sequence = "%s/%04d/00000" % (self.journal_id.code, self.date.year)
        else:
            starting_sequence = "%s/%04d/%02d/0000" % (self.journal_id.code, self.date.year, self.date.month)
        if self.journal_id.refund_sequence and self.move_type in ('out_refund', 'in_refund'):
            starting_sequence = "R" + starting_sequence
        if self.journal_id.payment_sequence and self.payment_id or self.env.context.get('is_payment'):
            starting_sequence = "P" + starting_sequence
        return starting_sequence

    def _get_sequence_date_range(self, reset):
        if reset == 'year_range':
            company = self.company_id
            return date_utils.get_fiscal_year(self.date, day=company.fiscalyear_last_day, month=int(company.fiscalyear_last_month))
        return super()._get_sequence_date_range(reset)

    # -------------------------------------------------------------------------
    # PAYMENT REFERENCE
    # -------------------------------------------------------------------------

    def _get_invoice_reference_euro_invoice(self):
        """ This computes the reference based on the RF Creditor Reference.
            The data of the reference is the database id number of the invoice.
            For instance, if an invoice is issued with id 43, the check number
            is 07 so the reference will be 'RF07 43'.
        """
        self.ensure_one()
        return format_structured_reference_iso(self.id)

    def _get_invoice_reference_euro_partner(self):
        """ This computes the reference based on the RF Creditor Reference.
            The data of the reference is the user defined reference of the
            partner or the database id number of the parter.
            For instance, if an invoice is issued for the partner with internal
            reference 'food buyer 654', the digits will be extracted and used as
            the data. This will lead to a check number equal to 00 and the
            reference will be 'RF00 654'.
            If no reference is set for the partner, its id in the database will
            be used.
        """
        self.ensure_one()
        partner_ref = self.partner_id.ref
        partner_ref_nr = re.sub(r'\D', '', partner_ref or '')[-21:] or str(self.partner_id.id)[-21:]
        partner_ref_nr = partner_ref_nr[-21:]
        return format_structured_reference_iso(partner_ref_nr)

    def _get_invoice_reference_odoo_invoice(self):
        """ This computes the reference based on the Odoo format.
            We simply return the number of the invoice, defined on the journal
            sequence.
        """
        self.ensure_one()
        return self.name

    def _get_invoice_reference_odoo_partner(self):
        """ This computes the reference based on the Odoo format.
            The data used is the reference set on the partner or its database
            id otherwise. For instance if the reference of the customer is
            'dumb customer 97', the reference will be 'CUST/dumb customer 97'.
        """
        ref = self.partner_id.ref or str(self.partner_id.id)
        prefix = _('CUST')
        return '%s/%s' % (prefix, ref)

    def _get_invoice_computed_reference(self):
        self.ensure_one()
        if self.journal_id.invoice_reference_type == 'none':
            return ''
        ref_function = getattr(self, f'_get_invoice_reference_{self.journal_id.invoice_reference_model}_{self.journal_id.invoice_reference_type}', None)
        if ref_function is None:
            raise UserError(_("The combination of reference model and reference type on the journal is not implemented"))
        return ref_function()

    # -------------------------------------------------------------------------
    # QUICK ENCODING
    # -------------------------------------------------------------------------
    @api.model
    def _get_frequent_account_and_taxes(self, company_id, partner_id, move_type):
        """
        Returns the most used accounts and taxes for a given partner and company,
        eventually filtered according to the move type.
        """
        if not partner_id:
            return 0, False, False
        domain = [
            *self.env['account.move.line']._check_company_domain(company_id),
            ('partner_id', '=', partner_id),
            ('account_id.deprecated', '=', False),
            ('date', '>=', date.today() - timedelta(days=365 * 2)),
        ]
        if move_type in self.env['account.move'].get_inbound_types(include_receipts=True):
            domain.append(('account_id.internal_group', '=', 'income'))
        elif move_type in self.env['account.move'].get_outbound_types(include_receipts=True):
            domain.append(('account_id.internal_group', '=', 'expense'))

        query = self.env['account.move.line']._where_calc(domain)
        rows = self.env.execute_query(SQL("""
            SELECT COUNT(foo.id), foo.account_id, foo.taxes
              FROM (
                         SELECT account_move_line__account_id.id AS account_id,
                                account_move_line__account_id.code,
                                account_move_line.id,
                                ARRAY_AGG(tax_rel.account_tax_id) FILTER (WHERE tax_rel.account_tax_id IS NOT NULL) AS taxes
                           FROM %s
                      LEFT JOIN account_move_line_account_tax_rel tax_rel ON account_move_line.id = tax_rel.account_move_line_id
                          WHERE %s
                       GROUP BY account_move_line__account_id.id,
                                account_move_line.id
                   ) AS foo
          GROUP BY foo.account_id, foo.code, foo.taxes
          ORDER BY COUNT(foo.id) DESC, foo.code, taxes ASC NULLS LAST
             LIMIT 1
        """, query.from_clause, query.where_clause or SQL("TRUE")))
        return rows[0] if rows else (0, False, False)

    def _get_quick_edit_suggestions(self):
        """
        Returns a dictionnary containing the suggested values when creating a new
        line with the quick_edit_total_amount set. We will compute the price_unit
        that has to be set with the correct that in order to match this total amount.
        If the vendor/customer is set, we will suggest the most frequently used account
        for that partner as the default one, otherwise the default of the journal.
        """
        self.ensure_one()
        if not self.quick_edit_mode or not self.quick_edit_total_amount:
            return False
        count, account_id, tax_ids = self._get_frequent_account_and_taxes(
            self.company_id.id,
            self.partner_id.id,
            self.move_type,
        )
        if count:
            taxes = self.env['account.tax'].browse(tax_ids)
        else:
            account_id = self.journal_id.default_account_id.id
            if self.is_sale_document(include_receipts=True):
                taxes = self.journal_id.default_account_id.tax_ids.filtered(lambda tax: tax.type_tax_use == 'sale')
            else:
                taxes = self.journal_id.default_account_id.tax_ids.filtered(lambda tax: tax.type_tax_use == 'purchase')
            if not taxes:
                taxes = (
                    self.journal_id.company_id.account_sale_tax_id
                    if self.journal_id.type == 'sale' else
                    self.journal_id.company_id.account_purchase_tax_id
                )
            taxes = self.fiscal_position_id.map_tax(taxes)

        # When a payment term has an early payment discount with the epd computation set to 'mixed', recomputing
        # the untaxed amount should take in consideration the discount percentage otherwise we'd get a wrong value.
        # We check that we have only one percentage tax as computing from multiple taxes with different types can get complicated.
        # In one example: let's say: base = 100, discount = 2%, tax = 21%
        # the total will be calculated as: total = base + (base * (1 - discount)) * tax
        # If we manipulate the equation to get the base from the total, we'll have base = total / ((1 - discount) * tax + 1)
        term = self.invoice_payment_term_id
        discount_percentage = term.discount_percentage if term.early_discount else 0
        remaining_amount = self.quick_edit_total_amount - self.tax_totals['amount_total']

        if (
            discount_percentage
            and term.early_pay_discount_computation == 'mixed'
            and len(taxes) == 1
            and taxes.amount_type == 'percent'
        ):
            price_untaxed = self.currency_id.round(
                remaining_amount / (((1.0 - discount_percentage / 100.0) * (taxes.amount / 100.0)) + 1.0))
        else:
            price_untaxed = taxes.with_context(force_price_include=True).compute_all(remaining_amount)['total_excluded']
        return {'account_id': account_id, 'tax_ids': taxes.ids, 'price_unit': price_untaxed}

    @api.onchange('quick_edit_mode', 'journal_id', 'company_id')
    def _quick_edit_mode_suggest_invoice_date(self):
        """Suggest the Customer Invoice/Vendor Bill date based on previous invoice and lock dates"""
        for record in self:
            if record.quick_edit_mode and not record.invoice_date:
                invoice_date = fields.Date.context_today(self)
                prev_move = self.search([('state', '=', 'posted'),
                                         ('journal_id', '=', record.journal_id.id),
                                         ('company_id', '=', record.company_id.id),
                                         ('invoice_date', '!=', False)],
                                        limit=1)
                if prev_move:
                    invoice_date = self._get_accounting_date(prev_move.invoice_date, False)
                record.invoice_date = invoice_date

    # -------------------------------------------------------------------------
    # HASH
    # -------------------------------------------------------------------------

    def _get_integrity_hash_fields(self):
        # Use the latest hash version by default, but keep the old one for backward compatibility when generating the integrity report.
        hash_version = self._context.get('hash_version', MAX_HASH_VERSION)
        if hash_version == 1:
            return ['date', 'journal_id', 'company_id']
        elif hash_version in (2, 3, 4):
            return ['name', 'date', 'journal_id', 'company_id']
        raise NotImplementedError(f"hash_version={hash_version} doesn't exist")

    def _get_integrity_hash_fields_and_subfields(self):
        return self._get_integrity_hash_fields() + [f'line_ids.{subfield}' for subfield in self.line_ids._get_integrity_hash_fields()]

    @api.model
    def _get_move_hash_domain(self, common_domain=False, force_hash=False):
        common_domain = expression.AND([
            common_domain or [],
            [('restrict_mode_hash_table', '=', True)]
        ])
        if force_hash:
            return expression.AND([common_domain, [('state', '=', 'posted')]])
        return expression.AND([
            common_domain,
            [('move_type', 'in', self.get_sale_types(include_receipts=True)), ('is_move_sent', '=', True)]
        ])

    @api.model
    def _is_move_restricted(self, move, force_hash=False):
        return move.filtered_domain(self._get_move_hash_domain(force_hash=force_hash))

    def _hash_moves(self, force_hash=False):
        chains_to_hash = self._get_chains_to_hash(force_hash=force_hash)
        for chain in chains_to_hash:
            move_hashes = chain['moves']._calculate_hashes(chain['previous_hash'])
            for move, move_hash in move_hashes.items():
                move.inalterable_hash = move_hash
            chain['moves']._message_log_batch(bodies={m.id: _("This move has been locked.") for m in chain['moves']})

    def _get_chains_to_hash(self, force_hash=False, raise_if_gap=True, raise_if_no_document=True, include_pre_last_hash=False, early_stop=False):
        """
        From a recordset of moves, retrieve the chains of moves that need to be hashed by taking
        into account the last move of each chain of the recordset.
        So if we have INV/1, INV/2, INV/3, INV4 that are not hashed yet in the database
        but self contains INV/2, INV/3, we will return INV/1, INV/2 and INV/3. Not INV/4.
        :param force_hash: if True, we'll check all moves posted, independently of whether they were sent or not
        :param raise_if_gap: if True, we'll raise an error if a gap is detected in the sequence
        :param raise_if_no_document: if True, we'll raise an error if no document needs to be hashed
        :param include_pre_last_hash: if True, we'll include the moves not hashed that are previous to the last hashed move
        :param early_stop: if True, we'll stop the computation as soon as we find at least one document to hash
        """
        res = []  # List of dict {'previous_hash': str, 'moves': recordset}
        for journal, journal_moves in self.grouped('journal_id').items():
            for chain_moves in journal_moves.grouped('sequence_prefix').values():
                last_move_in_chain = chain_moves.sorted('sequence_number')[-1]
                if not self._is_move_restricted(last_move_in_chain, force_hash=force_hash):
                    continue

                common_domain = [
                    ('journal_id', '=', journal.id),
                    ('sequence_prefix', '=', last_move_in_chain.sequence_prefix),
                ]
                last_move_hashed = self.env['account.move'].search([
                    *common_domain,
                    ('inalterable_hash', '!=', False),
                ], order='sequence_number desc', limit=1)

                domain = self.env['account.move']._get_move_hash_domain([
                    *common_domain,
                    ('sequence_number', '<=', last_move_in_chain.sequence_number),
                    ('inalterable_hash', '=', False),
                    ('date', '>', last_move_in_chain.company_id._get_user_fiscal_lock_date()),
                ], force_hash=True)
                if last_move_hashed and not include_pre_last_hash:
                    # Hash moves only after the last hashed move, not the ones that may have been posted before the journal was set on restrict mode
                    domain.extend([('sequence_number', '>', last_move_hashed.sequence_number)])

                # On the accounting dashboard, we are only interested on whether there are documents to hash or not
                # so we can stop the computation early if we find at least one document to hash
                if early_stop:
                    if self.env['account.move'].sudo().search_count(domain, limit=1):
                        return True
                    continue
                moves_to_hash = self.env['account.move'].sudo().search(domain, order='sequence_number')
                if not moves_to_hash and force_hash and raise_if_no_document:
                    raise UserError(_(
                        "This move could not be locked either because:\n"
                        "- some move with the same sequence prefix has a higher number. You may need to resequence it.\n"
                        "- the move's date is anterior to the lock date"
                    ))
                if raise_if_gap and moves_to_hash and moves_to_hash[0].sequence_number + len(moves_to_hash) - 1 != moves_to_hash[-1].sequence_number:
                    raise UserError(_(
                        "An error occurred when computing the inalterability. A gap has been detected in the sequence."
                    ))

                res.append({
                    'previous_hash': last_move_hashed.inalterable_hash,
                    'moves': moves_to_hash.sudo(False),
                })
        if early_stop:
            return False
        return res

    def _calculate_hashes(self, previous_hash):
        """
        :return: dict of move_id: hash
        """
        hash_version = self._context.get('hash_version', MAX_HASH_VERSION)

        def _getattrstring(obj, field_name):
            field_value = obj[field_name]
            if obj._fields[field_name].type == 'many2one':
                field_value = field_value.id
            if obj._fields[field_name].type == 'monetary' and hash_version >= 3:
                return float_repr(field_value, obj.currency_id.decimal_places)
            return str(field_value)

        move2hash = {}
        previous_hash = previous_hash or ''

        for move in self:
            if previous_hash and previous_hash.startswith("$"):
                previous_hash = previous_hash.split("$")[2]  # The hash version is not used for the computation of the next hash
            values = {}
            for fname in move._get_integrity_hash_fields():
                values[fname] = _getattrstring(move, fname)

            for line in move.line_ids:
                for fname in line._get_integrity_hash_fields():
                    k = 'line_%d_%s' % (line.id, fname)
                    values[k] = _getattrstring(line, fname)
            current_record = dumps(values, sort_keys=True, ensure_ascii=True, indent=None, separators=(',', ':'))
            hash_string = sha256((previous_hash + current_record).encode('utf-8')).hexdigest()
            move2hash[move] = f"${hash_version}${hash_string}" if hash_version >= 4 else hash_string
            previous_hash = move2hash[move]
        return move2hash

    # -------------------------------------------------------------------------
    # RECURRING ENTRIES
    # -------------------------------------------------------------------------

    @api.model
    def _apply_delta_recurring_entries(self, date, date_origin, period):
        '''Advances date by `period` months, maintaining original day of the month if possible.'''
        deltas = {'monthly': 1, 'quarterly': 3, 'yearly': 12}
        prev_months = (date.year - date_origin.year) * 12 + date.month - date_origin.month
        return date_origin + relativedelta(months=deltas[period] + prev_months)

    def _copy_recurring_entries(self):
        ''' Creates a copy of a recurring (periodic) entry and adjusts its dates for the next period.
        Meant to be called right after posting a periodic entry.
        Copies extra fields as defined by _get_fields_to_copy_recurring_entries().
        '''
        for record in self:
            record.auto_post_origin_id = record.auto_post_origin_id or record  # original entry references itself
            next_date = self._apply_delta_recurring_entries(record.date, record.auto_post_origin_id.date, record.auto_post)

            if not record.auto_post_until or next_date <= record.auto_post_until:  # recurrence continues
                record.copy(default=record._get_fields_to_copy_recurring_entries({'date': next_date}))

    def _get_fields_to_copy_recurring_entries(self, values):
        ''' Determines which extra fields to copy when copying a recurring entry.
        To be extended by modules that add fields with copy=False (implicit or explicit)
        whenever the opposite behavior is expected for recurring invoices.
        '''
        values.update({
            'auto_post': self.auto_post,  # copy=False to avoid mistakes but should be the same in recurring copies
            'auto_post_until': self.auto_post_until,  # same as above
            'auto_post_origin_id': self.auto_post_origin_id.id,  # same as above
            'invoice_user_id': self.invoice_user_id.id,  # otherwise user would be OdooBot
        })
        if self.invoice_date:
            values.update({'invoice_date': self._apply_delta_recurring_entries(self.invoice_date, self.auto_post_origin_id.invoice_date, self.auto_post)})
        if not self.invoice_payment_term_id and self.invoice_date_due:
            # no payment terms: maintain timedelta between due date and accounting date
            values.update({'invoice_date_due': values['date'] + (self.invoice_date_due - self.date)})
        return values

    # -------------------------------------------------------------------------
    # EDI
    # -------------------------------------------------------------------------

    @contextmanager
    def _get_edi_creation(self):
        """Get an environment to import documents from other sources.

        Allow to edit the current move or create a new one.
        This will prevent computing the dynamic lines at each invoice line added and only
        compute everything at the end.
        """
        container = {'records': self}
        with self._check_balanced(container),\
             self._disable_discount_precision(),\
             self._sync_dynamic_lines(container):
            move = self or self.create({})
            yield move
            container['records'] = move

    @contextmanager
    def _disable_discount_precision(self):
        """Disable the user defined precision for discounts.

        This is useful for importing documents coming from other softwares and providers.
        The reasonning is that if the document that we are importing has a discount, it
        shouldn't be rounded to the local settings.
        """
        with self._disable_recursion({'records': self}, 'ignore_discount_precision'):
            yield

    def _get_edi_decoder(self, file_data, new=False):
        """To be extended with decoding capabilities.
        :returns:  Function to be later used to import the file.
                   Function' args:
                   - invoice: account.move
                   - file_data: attachemnt information / value
                   - new: whether the invoice is newly created
                   returns True if was able to process the invoice
        """
        if file_data['type'] in ('pdf', 'binary'):
            return lambda *args: False
        return

    def _extend_with_attachments(self, attachments, new=False):
        """Main entry point to extend/enhance invoices with attachments.

        Either coming from:
        - The chatter when the user drops an attachment on an existing invoice.
        - The journal when the user drops one or multiple attachments from the dashboard.
        - The server mail alias when an alias is configured on the journal.

        It will unwrap all attachments by priority then try to decode until it succeed.

        :param attachments: A recordset of ir.attachment.
        :param new:         Indicate if the current invoice is a fresh one or an existing one.
        :returns:           True if at least one document is successfully imported
        """
        def close_file(file_data):
            if file_data.get('on_close'):
                file_data['on_close']()

        def add_file_data_results(file_data, invoice):
            passed_file_data_list.append(file_data)
            attachment = file_data.get('attachment') or file_data.get('originator_pdf')
            if attachment:
                if attachments_by_invoice.get(attachment):
                    attachments_by_invoice[attachment] |= invoice
                else:
                    attachments_by_invoice[attachment] = invoice

        file_data_list = attachments._unwrap_edi_attachments()
        attachments_by_invoice = {}
        invoices = self
        current_invoice = self
        passed_file_data_list = []
        for file_data in file_data_list:

            # Rogue binaries from mail alias are skipped and unlinked.
            if (
                file_data['type'] == 'binary'
                and self._context.get('from_alias')
                and not attachments_by_invoice.get(file_data['attachment'])
            ):
                close_file(file_data)
                continue

            # The invoice has already been decoded by an embedded file.
            if attachments_by_invoice.get(file_data['attachment']):
                add_file_data_results(file_data, attachments_by_invoice[file_data['attachment']])
                close_file(file_data)
                continue

            # When receiving multiple files, if they have a different type, we supposed they are all linked
            # to the same invoice.
            if (
                passed_file_data_list
                and passed_file_data_list[-1]['filename'] != file_data['filename']
                and passed_file_data_list[-1]['sort_weight'] != file_data['sort_weight']
            ):
                add_file_data_results(file_data, invoices[-1])
                close_file(file_data)
                continue

            if passed_file_data_list and not new:
                add_file_data_results(file_data, invoices[-1])
                close_file(file_data)
                continue

            extend_with_existing_lines = file_data.get('process_if_existing_lines', False)
            if current_invoice.invoice_line_ids and not extend_with_existing_lines:
                continue

            decoder = (current_invoice or current_invoice.new(self.default_get(['move_type', 'journal_id'])))._get_edi_decoder(file_data, new=new)
            if decoder:
                try:
                    with self.env.cr.savepoint():
                        with current_invoice._get_edi_creation() as invoice:
                            existing_lines = invoice.invoice_line_ids
                            # pylint: disable=not-callable
                            success = decoder(invoice, file_data, new)
                        if success or file_data['type'] == 'pdf':
                            (invoice.invoice_line_ids - existing_lines).is_imported = True
                            invoice._link_bill_origin_to_purchase_orders(timeout=4)

                            invoices |= invoice
                            current_invoice = self.env['account.move']
                            add_file_data_results(file_data, invoice)
                        if extend_with_existing_lines:
                            return attachments_by_invoice

                except RedirectWarning:
                    raise
                except Exception:
                    message = _(
                        "Error importing attachment '%(file_name)s' as invoice (decoder=%(decoder)s)",
                        file_name=file_data['filename'],
                        decoder=decoder.__name__,
                    )
                    invoice.sudo().message_post(body=message)
                    _logger.exception(message)

            passed_file_data_list.append(file_data)
            close_file(file_data)

        return attachments_by_invoice

    # -------------------------------------------------------------------------
    # BUSINESS METHODS
    # -------------------------------------------------------------------------

    def _get_debit_credit_from_balance(self, balance):
        self.ensure_one()
        if self.is_storno:
            debit = balance if balance < 0.0 else 0.0
            credit = -balance if balance > 0.0 else 0.0
        else:
            debit = balance if balance > 0.0 else 0.0
            credit = -balance if balance < 0.0 else 0.0
        return debit, credit

    def _prepare_invoice_aggregated_taxes(self, filter_invl_to_apply=None, filter_tax_values_to_apply=None, grouping_key_generator=None, distribute_total_on_line=True):
        self.ensure_one()
        company = self.company_id
        invoice_lines = self.line_ids.filtered(lambda x: x.display_type == 'product' and (not filter_invl_to_apply or filter_invl_to_apply(x)))

        # Prepare the tax details for each line.
        to_process = []
        for invoice_line in invoice_lines:
            base_line = invoice_line._convert_to_tax_base_line_dict()
            tax_details_results = self.env['account.tax']._prepare_base_line_tax_details(base_line, company)
            to_process.append((base_line, tax_details_results))

        # Handle manually changed tax amounts (via quick-edit or journal entry manipulation):
        # For each tax repartition line we compute the difference between the following 2 amounts
        #     * Manual tax amount:
        #       The sum of the amounts on the tax lines belonging to the tax repartition line.
        #       These amounts may have been manually changed.
        #     * Computed tax amount:
        #       The sum of the amounts on the items in 'taxes_data' in 'to_process' belonging to the tax repartition line.
        # This difference is then distributed evenly across the 'taxes_data' in 'to_process'
        # such that the manual and computed tax amounts match.
        # The updated tax information is later used by '_aggregate_taxes' to compute the right tax amounts (consistently on all levels).
        tax_lines = self.line_ids.filtered(lambda x: x.display_type == 'tax')
        sign = -1 if self.is_inbound(include_receipts=True) else 1

        # Collect the tax_amount_currency/balance from tax lines.
        current_tax_amount_per_rep_line = {}
        for tax_line in tax_lines:
            tax_rep_amounts = current_tax_amount_per_rep_line.setdefault(tax_line.tax_repartition_line_id.id, {
                'tax_amount_currency': 0.0,
                'tax_amount': 0.0,
            })
            tax_rep_amounts['tax_amount_currency'] += sign * tax_line.amount_currency
            tax_rep_amounts['tax_amount'] += sign * tax_line.balance

        # Collect the computed tax_amount_currency/tax_amount from the taxes computation.
        tax_details_per_rep_line = {}
        for _base_line, tax_details_results in to_process:
            for tax_data in tax_details_results['taxes_data']:
                tax_rep = tax_data['tax_repartition_line']
                tax_rep_amounts = tax_details_per_rep_line.setdefault(tax_rep.id, {
                    'tax_amount_currency': 0.0,
                    'tax_amount': 0.0,
                    'distribute_on': [],
                })
                tax_rep_amounts['tax_amount_currency'] += tax_data['tax_amount_currency']
                tax_rep_amounts['tax_amount'] += tax_data['tax_amount']
                tax_rep_amounts['distribute_on'].append(tax_data)

        # Dispatch the delta on tax_values.
        for key, currency in (('tax_amount_currency', self.currency_id), ('tax_amount', self.company_currency_id)):
            for tax_rep_id, computed_tax_rep_amounts in tax_details_per_rep_line.items():
                current_tax_rep_amounts = current_tax_amount_per_rep_line.get(tax_rep_id, computed_tax_rep_amounts)
                diff = current_tax_rep_amounts[key] - computed_tax_rep_amounts[key]
                abs_diff = abs(diff)

                if currency.is_zero(abs_diff):
                    continue

                diff_sign = -1 if diff < 0 else 1
                nb_error = math.ceil(abs_diff / currency.rounding)
                nb_cents_per_tax_values = math.floor(nb_error / len(computed_tax_rep_amounts['distribute_on']))
                nb_extra_cent = nb_error % len(computed_tax_rep_amounts['distribute_on'])
                for tax_data in computed_tax_rep_amounts['distribute_on']:

                    if currency.is_zero(abs_diff):
                        break

                    nb_amount_curr_cent = nb_cents_per_tax_values
                    if nb_extra_cent:
                        nb_amount_curr_cent += 1
                        nb_extra_cent -= 1

                    # We can have more than one cent to distribute on a single tax_values.
                    abs_delta_to_add = min(abs_diff, currency.rounding * nb_amount_curr_cent)
                    tax_data[key] += diff_sign * abs_delta_to_add
                    abs_diff -= abs_delta_to_add

        return self.env['account.tax']._aggregate_taxes(
            to_process,
            company,
            filter_tax_values_to_apply=filter_tax_values_to_apply,
            grouping_key_generator=grouping_key_generator,
            distribute_total_on_line=distribute_total_on_line,
        )

    def _get_invoice_counterpart_amls_for_early_payment_discount_per_payment_term_line(self):
        """ Helper to get the values to create the counterpart journal items on the register payment wizard and the
        bank reconciliation widget in case of an early payment discount. When the early payment discount computation
        is included, we need to compute the base amounts / tax amounts for each receivable / payable but we need to
        take care about the rounding issues. For others computations, we need to balance the discount you get.

        :return: A list of values to create the counterpart journal items split in 3 categories:
            * term_lines:   The journal items containing the discount amounts for each receivable line when the
                            discount computation is excluded / mixed.
            * tax_lines:    The journal items acting as tax lines when the discount computation is included.
            * base_lines:   The journal items acting as base for tax lines when the discount computation is included.
        """
        self.ensure_one()

        def inverse_tax_rep(tax_rep):
            tax = tax_rep.tax_id
            index = list(tax.invoice_repartition_line_ids).index(tax_rep)
            return tax.refund_repartition_line_ids[index]

        company = self.company_id
        payment_term_line = self.line_ids.filtered(lambda x: x.display_type == 'payment_term')
        tax_lines = self.line_ids.filtered(lambda x: x.display_type == 'tax')
        invoice_lines = self.line_ids.filtered(lambda x: x.display_type == 'product')
        payment_term = self.invoice_payment_term_id
        early_pay_discount_computation = payment_term.early_pay_discount_computation
        discount_percentage = payment_term.discount_percentage

        res = {
            'term_lines': defaultdict(lambda: {}),
            'tax_lines': defaultdict(lambda: {}),
            'base_lines': defaultdict(lambda: {}),
        }
        if not discount_percentage:
            return res

        # Get the current tax amounts in the current invoice.
        tax_amounts = {
            inverse_tax_rep(line.tax_repartition_line_id).id: {
                'amount_currency': line.amount_currency,
                'balance': line.balance,
            }
            for line in tax_lines
        }

        base_lines = [
            {
                **x._convert_to_tax_base_line_dict(),
                'is_refund': True,
            }
            for x in invoice_lines
        ]
        for base_line in base_lines:
            base_line['taxes'] = base_line['taxes'].filtered(lambda t: t.amount_type != 'fixed')

            if early_pay_discount_computation == 'included':
                remaining_part_to_consider = (100 - discount_percentage) / 100.0
                base_line['price_unit'] *= remaining_part_to_consider

        # Prepare the tax details for each line.
        to_process = []
        for base_line in base_lines:
            tax_details_results = self.env['account.tax']._prepare_base_line_tax_details(base_line, company)
            to_process.append((base_line, tax_details_results))

        # Aggregate taxes.
        def grouping_key_generator(base_line, tax_values):
            return self.env['account.tax']._get_generation_dict_from_base_line(base_line, tax_values)

        tax_details_with_epd = self.env['account.tax']._aggregate_taxes(to_process, company, grouping_key_generator=grouping_key_generator)

        if self.is_inbound(include_receipts=True):
            cash_discount_account = company.account_journal_early_pay_discount_loss_account_id
        else:
            cash_discount_account = company.account_journal_early_pay_discount_gain_account_id

        bases_details = {}

        term_amount_currency = payment_term_line.amount_currency - payment_term_line.discount_amount_currency
        term_balance = payment_term_line.balance - payment_term_line.discount_balance
        if early_pay_discount_computation == 'included' and invoice_lines.tax_ids:
            # Compute the base amounts.
            resulting_delta_base_details = {}
            resulting_delta_tax_details = {}
            for base_line, tax_details_results in to_process:
                invoice_line = base_line['record']

                grouping_dict = {
                    'tax_ids': [Command.set(base_line['taxes'].ids)],
                    'tax_tag_ids': tax_details_results['base_tags'].ids,
                    'partner_id': base_line['partner'].id,
                    'currency_id': base_line['currency'].id,
                    'account_id': cash_discount_account.id,
                    'analytic_distribution': base_line['analytic_distribution'],
                }
                base_detail = resulting_delta_base_details.setdefault(frozendict(grouping_dict), {
                    'balance': 0.0,
                    'amount_currency': 0.0,
                })

                amount_currency = self.currency_id\
                    .round(self.direction_sign * tax_details_results['total_excluded'] - invoice_line.amount_currency)
                balance = self.company_currency_id\
                    .round(amount_currency / base_line['rate'])

                base_detail['balance'] += balance
                base_detail['amount_currency'] += amount_currency

                bases_details[frozendict(grouping_dict)] = base_detail

            # Compute the tax amounts.
            for tax_detail in tax_details_with_epd['tax_details'].values():
                tax_amount_without_epd = tax_amounts.get(tax_detail['tax_repartition_line_id'])
                if not tax_amount_without_epd:
                    continue

                tax_amount_currency = self.currency_id\
                    .round(self.direction_sign * tax_detail['tax_amount_currency'] - tax_amount_without_epd['amount_currency'])
                tax_amount = self.company_currency_id\
                    .round(self.direction_sign * tax_detail['tax_amount'] - tax_amount_without_epd['balance'])

                if self.currency_id.is_zero(tax_amount_currency) and self.company_currency_id.is_zero(tax_amount):
                    continue

                resulting_delta_tax_details[tax_detail['tax_repartition_line_id']] = {
                    **tax_detail,
                    'amount_currency': tax_amount_currency,
                    'balance': tax_amount,
                }

            # Multiply the amount by the percentage
            percentage_paid = abs(payment_term_line.amount_residual_currency / self.amount_total)
            for tax_detail in resulting_delta_tax_details.values():
                tax_rep = self.env['account.tax.repartition.line'].browse(tax_detail['tax_repartition_line_id'])
                tax = tax_rep.tax_id

                grouping_dict = {
                    'account_id': tax_detail['account_id'],
                    'partner_id': tax_detail['partner_id'],
                    'currency_id': tax_detail['currency_id'],
                    'analytic_distribution': tax_detail['analytic_distribution'],
                    'tax_repartition_line_id': tax_rep.id,
                    'tax_ids': tax_detail['tax_ids'],
                    'tax_tag_ids': tax_detail['tax_tag_ids'],
                    'group_tax_id': tax_detail['group_tax_id'],
                }

                res['tax_lines'][payment_term_line][frozendict(grouping_dict)] = {
                    'name': _("Early Payment Discount (%s)", tax.name),
                    'amount_currency': payment_term_line.currency_id.round(tax_detail['amount_currency'] * percentage_paid),
                    'balance': payment_term_line.company_currency_id.round(tax_detail['balance'] * percentage_paid),
                }

            for grouping_dict, base_detail in bases_details.items():
                res['base_lines'][payment_term_line][grouping_dict] = {
                    'name': _("Early Payment Discount"),
                    'amount_currency': payment_term_line.currency_id.round(base_detail['amount_currency'] * percentage_paid),
                    'balance': payment_term_line.company_currency_id.round(base_detail['balance'] * percentage_paid),
                }

            # Fix the rounding issue if any.
            delta_amount_currency = term_amount_currency \
                                    - sum(x['amount_currency'] for x in res['base_lines'][payment_term_line].values()) \
                                    - sum(x['amount_currency'] for x in res['tax_lines'][payment_term_line].values())
            delta_balance = term_balance \
                            - sum(x['balance'] for x in res['base_lines'][payment_term_line].values()) \
                            - sum(x['balance'] for x in res['tax_lines'][payment_term_line].values())

            last_tax_line = (list(res['tax_lines'][payment_term_line].values()) or list(res['base_lines'][payment_term_line].values()))[-1]
            last_tax_line['amount_currency'] += delta_amount_currency
            last_tax_line['balance'] += delta_balance

        else:
            grouping_dict = {'account_id': cash_discount_account.id}

            res['term_lines'][payment_term_line][frozendict(grouping_dict)] = {
                'name': _("Early Payment Discount"),
                'partner_id': payment_term_line.partner_id.id,
                'currency_id': payment_term_line.currency_id.id,
                'amount_currency': term_amount_currency,
                'balance': term_balance,
            }

        return res

    @api.model
    def _get_invoice_counterpart_amls_for_early_payment_discount(self, aml_values_list, open_balance):
        """ Helper to get the values to create the counterpart journal items on the register payment wizard and the
        bank reconciliation widget in case of an early payment discount by taking care of the payment term lines we
        are matching and the exchange difference in case of multi-currencies.

        :param aml_values_list: A list of dictionaries containing:
            * aml:              The payment term line we match.
            * amount_currency:  The matched amount_currency for this line.
            * balance:          The matched balance for this line (could be different in case of multi-currencies).
        :param open_balance:    The current open balance to be covered by the early payment discount.
        :return: A list of values to create the counterpart journal items split in 3 categories:
            * term_lines:       The journal items containing the discount amounts for each receivable line when the
                                discount computation is excluded / mixed.
            * tax_lines:        The journal items acting as tax lines when the discount computation is included.
            * base_lines:       The journal items acting as base for tax lines when the discount computation is included.
            * exchange_lines:   The journal items representing the exchange differences in case of multi-currencies.
        """
        res = {
            'base_lines': {},
            'tax_lines': {},
            'term_lines': {},
            'exchange_lines': {},
        }

        res_per_invoice = {}
        for aml_values in aml_values_list:
            aml = aml_values['aml']
            invoice = aml.move_id

            if invoice not in res_per_invoice:
                res_per_invoice[invoice] = invoice._get_invoice_counterpart_amls_for_early_payment_discount_per_payment_term_line()

            for key in ('base_lines', 'tax_lines', 'term_lines'):
                for grouping_dict, vals in res_per_invoice[invoice][key][aml].items():
                    line_vals = res[key].setdefault(grouping_dict, {
                        **vals,
                        'amount_currency': 0.0,
                        'balance': 0.0,
                    })
                    line_vals['amount_currency'] += vals['amount_currency']
                    line_vals['balance'] += vals['balance']

                    # Track the balance to handle the exchange difference.
                    open_balance -= vals['balance']

        exchange_diff_sign = aml.company_currency_id.compare_amounts(open_balance, 0.0)
        if exchange_diff_sign != 0.0:

            if exchange_diff_sign > 0.0:
                exchange_line_account = aml.company_id.expense_currency_exchange_account_id
            else:
                exchange_line_account = aml.company_id.income_currency_exchange_account_id

            grouping_dict = {
                'account_id': exchange_line_account.id,
                'currency_id': aml.currency_id.id,
                'partner_id': aml.partner_id.id,
            }
            line_vals = res['exchange_lines'].setdefault(frozendict(grouping_dict), {
                **grouping_dict,
                'name': _("Early Payment Discount (Exchange Difference)"),
                'amount_currency': 0.0,
                'balance': 0.0,
            })
            line_vals['balance'] += open_balance

        return {
            key: [
                {
                    **grouping_dict,
                    **vals,
                }
                for grouping_dict, vals in mapping.items()
            ]
            for key, mapping in res.items()
        }

    def _affect_tax_report(self):
        return any(line._affect_tax_report() for line in (self.line_ids | self.invoice_line_ids))

    def _get_move_display_name(self, show_ref=False):
        ''' Helper to get the display name of an invoice depending of its type.
        :param show_ref:    A flag indicating of the display name must include or not the journal entry reference.
        :return:            A string representing the invoice.
        '''
        self.ensure_one()
        if self.env.context.get('name_as_amount_total'):
            currency_amount = self.currency_id.format(self.amount_total)
            if self.state == 'posted':
                return _("%(ref)s (%(currency_amount)s)", ref=(self.ref or self.name), currency_amount=currency_amount)
            else:
                return _("Draft (%(currency_amount)s)", currency_amount=currency_amount)
        name = ''
        if self.state == 'draft':
            name += {
                'out_invoice': _('Draft Invoice'),
                'out_refund': _('Draft Credit Note'),
                'in_invoice': _('Draft Bill'),
                'in_refund': _('Draft Vendor Credit Note'),
                'out_receipt': _('Draft Sales Receipt'),
                'in_receipt': _('Draft Purchase Receipt'),
                'entry': _('Draft Entry'),
            }[self.move_type]
            name += ' '
        if self.name and self.name != '/':
            name += self.name
            if self.env.context.get('input_full_display_name'):
                if self.partner_id:
                    name += f', {self.partner_id.name}'
                if self.date:
                    name += f', {format_date(self.env, self.date)}'
        return name + (f" ({shorten(self.ref, width=50)})" if show_ref and self.ref else '')

    def _get_reconciled_amls(self):
        """Helper used to retrieve the reconciled move lines on this journal entry"""
        reconciled_lines = self.line_ids.filtered(lambda line: line.account_id.account_type in ('asset_receivable', 'liability_payable'))
        return reconciled_lines.mapped('matched_debit_ids.debit_move_id') + reconciled_lines.mapped('matched_credit_ids.credit_move_id')

    def _get_reconciled_payments(self):
        """Helper used to retrieve the reconciled payments on this journal entry"""
        return self._get_reconciled_amls().move_id.payment_id

    def _get_reconciled_statement_lines(self):
        """Helper used to retrieve the reconciled statement lines on this journal entry"""
        return self._get_reconciled_amls().move_id.statement_line_id

    def _get_reconciled_invoices(self):
        """Helper used to retrieve the reconciled invoices on this journal entry"""
        return self._get_reconciled_amls().move_id.filtered(lambda move: move.is_invoice(include_receipts=True))

    def _get_all_reconciled_invoice_partials(self):
        self.ensure_one()
        reconciled_lines = self.line_ids.filtered(lambda line: line.account_id.account_type in ('asset_receivable', 'liability_payable'))
        if not reconciled_lines:
            return {}

        self.env['account.partial.reconcile'].flush_model([
            'credit_amount_currency', 'credit_move_id', 'debit_amount_currency',
            'debit_move_id', 'exchange_move_id',
        ])
        sql = SQL('''
            SELECT
                part.id,
                part.exchange_move_id,
                part.debit_amount_currency AS amount,
                part.credit_move_id AS counterpart_line_id
            FROM account_partial_reconcile part
            WHERE part.debit_move_id IN %(line_ids)s

            UNION ALL

            SELECT
                part.id,
                part.exchange_move_id,
                part.credit_amount_currency AS amount,
                part.debit_move_id AS counterpart_line_id
            FROM account_partial_reconcile part
            WHERE part.credit_move_id IN %(line_ids)s
        ''', line_ids=tuple(reconciled_lines.ids))

        partial_values_list = []
        counterpart_line_ids = set()
        exchange_move_ids = set()
        for values in self.env.execute_query_dict(sql):
            partial_values_list.append({
                'aml_id': values['counterpart_line_id'],
                'partial_id': values['id'],
                'amount': values['amount'],
                'currency': self.currency_id,
            })
            counterpart_line_ids.add(values['counterpart_line_id'])
            if values['exchange_move_id']:
                exchange_move_ids.add(values['exchange_move_id'])

        if exchange_move_ids:
            self.env['account.move.line'].flush_model(['move_id'])
            sql = SQL('''
                SELECT
                    part.id,
                    part.credit_move_id AS counterpart_line_id
                FROM account_partial_reconcile part
                JOIN account_move_line credit_line ON credit_line.id = part.credit_move_id
                WHERE credit_line.move_id IN %(exchange_move_ids)s AND part.debit_move_id IN %(counterpart_line_ids)s

                UNION ALL

                SELECT
                    part.id,
                    part.debit_move_id AS counterpart_line_id
                FROM account_partial_reconcile part
                JOIN account_move_line debit_line ON debit_line.id = part.debit_move_id
                WHERE debit_line.move_id IN %(exchange_move_ids)s AND part.credit_move_id IN %(counterpart_line_ids)s
            ''', exchange_move_ids=tuple(exchange_move_ids), counterpart_line_ids=tuple(counterpart_line_ids))

            for part_id, line_ids in self.env.execute_query(sql):
                counterpart_line_ids.add(line_ids)
                partial_values_list.append({
                    'aml_id': line_ids,
                    'partial_id': part_id,
                    'currency': self.company_id.currency_id,
                })

        counterpart_lines = {x.id: x for x in self.env['account.move.line'].browse(counterpart_line_ids)}
        for partial_values in partial_values_list:
            partial_values['aml'] = counterpart_lines[partial_values['aml_id']]
            partial_values['is_exchange'] = partial_values['aml'].move_id.id in exchange_move_ids
            if partial_values['is_exchange']:
                partial_values['amount'] = abs(partial_values['aml'].balance)

        return partial_values_list

    def _get_reconciled_invoices_partials(self):
        ''' Helper to retrieve the details about reconciled invoices.
        :return A list of tuple (partial, amount, invoice_line).
        '''
        self.ensure_one()
        pay_term_lines = self.line_ids\
            .filtered(lambda line: line.account_type in ('asset_receivable', 'liability_payable'))
        invoice_partials = []
        exchange_diff_moves = []

        for partial in pay_term_lines.matched_debit_ids:
            invoice_partials.append((partial, partial.credit_amount_currency, partial.debit_move_id))
            if partial.exchange_move_id:
                exchange_diff_moves.append(partial.exchange_move_id.id)
        for partial in pay_term_lines.matched_credit_ids:
            invoice_partials.append((partial, partial.debit_amount_currency, partial.credit_move_id))
            if partial.exchange_move_id:
                exchange_diff_moves.append(partial.exchange_move_id.id)
        return invoice_partials, exchange_diff_moves

    def _reconcile_reversed_moves(self, reverse_moves, move_reverse_cancel):
        ''' Reconciles moves in self and reverse moves
        :param move_reverse_cancel: parameter used when lines are reconciled
                                    will determine whether the tax cash basis journal entries should be created
        :param reverse_moves:       An account.move recordset, reverse of the current self.
        :return:                    An account.move recordset, reverse of the current self.
        '''
        for move, reverse_move in zip(self, reverse_moves):
            group = (move.line_ids + reverse_move.line_ids) \
                .filtered(lambda l: not l.reconciled) \
                .grouped(lambda l: (l.account_id, l.currency_id))
            for (account, _currency), lines in group.items():
                if account.reconcile or account.account_type in ('asset_cash', 'liability_credit_card'):
                    lines.with_context(move_reverse_cancel=move_reverse_cancel).reconcile()
        return reverse_moves

    def _reverse_moves(self, default_values_list=None, cancel=False):
        ''' Reverse a recordset of account.move.
        If cancel parameter is true, the reconcilable or liquidity lines
        of each original move will be reconciled with its reverse's.
        :param default_values_list: A list of default values to consider per move.
                                    ('type' & 'reversed_entry_id' are computed in the method).
        :return:                    An account.move recordset, reverse of the current self.
        '''
        if not default_values_list:
            default_values_list = [{} for move in self]

        if cancel:
            lines = self.mapped('line_ids')
            # Avoid maximum recursion depth.
            if lines:
                lines.remove_move_reconcile()

        create_values_list = []
        for move, default_values in zip(self, default_values_list):
            default_values.update({
                'move_type': TYPE_REVERSE_MAP[move.move_type],
                'reversed_entry_id': move.id,
                'partner_id': move.partner_id.id,
            })
            create_values = move\
                .with_context(move_reverse_cancel=cancel, include_business_fields=True)\
                .copy_data(default_values)[0]
            create_values['line_ids'] = [
                Command.create({
                    **command[2],
                    'balance': -command[2]['balance'],
                    'amount_currency': -command[2]['amount_currency'],
                })
                for command in create_values['line_ids']
                if (
                    move.is_entry()
                    or (
                        move.is_invoice(include_receipts=True)
                        and command[2]['display_type'] in ('cogs', 'product', 'line_section', 'line_note')
                    )
                )
            ]
            create_values_list.append(create_values)
        reverse_moves = self.create(create_values_list)

        # Reconcile moves together to cancel the previous one.
        if cancel:
            reverse_moves.with_context(move_reverse_cancel=cancel)._post(soft=False)

        return reverse_moves

    def _unlink_or_reverse(self):
        if not self:
            return
        to_reverse = self.env['account.move']
        to_unlink = self.env['account.move']
        for move in self:
            lock_date = move.company_id._get_user_fiscal_lock_date()
            if move.inalterable_hash or move.date <= lock_date:
                to_reverse += move
            else:
                to_unlink += move
        to_unlink.filtered(lambda m: m.state in ('posted', 'cancel')).button_draft()
        to_unlink.filtered(lambda m: m.state == 'draft').unlink()
        return to_reverse._reverse_moves(cancel=True)

    def _post(self, soft=True):
        """Post/Validate the documents.

        Posting the documents will give it a number, and check that the document is
        complete (some fields might not be required if not posted but are required
        otherwise).
        If the journal is locked with a hash table, it will be impossible to change
        some fields afterwards.

        :param soft (bool): if True, future documents are not immediately posted,
            but are set to be auto posted automatically at the set accounting date.
            Nothing will be performed on those documents before the accounting date.
        :return Model<account.move>: the documents that have been posted
        """
        if not self.env.su and not self.env.user.has_group('account.group_account_invoice'):
            raise AccessError(_("You don't have the access rights to post an invoice."))

        validation_msgs = set()

        for invoice in self.filtered(lambda move: move.is_invoice(include_receipts=True)):
            if (
                invoice.quick_edit_mode
                and invoice.quick_edit_total_amount
                and invoice.currency_id.compare_amounts(invoice.quick_edit_total_amount, invoice.amount_total) != 0
            ):
                validation_msgs.add(_(
                    "The current total is %(current_total)s but the expected total is %(expected_total)s. In order to post the invoice/bill, "
                    "you can adjust its lines or the expected Total (tax inc.).",
                    current_total=formatLang(self.env, invoice.amount_total, currency_obj=invoice.currency_id),
                    expected_total=formatLang(self.env, invoice.quick_edit_total_amount, currency_obj=invoice.currency_id),
                ))
            if invoice.partner_bank_id and not invoice.partner_bank_id.active:
                validation_msgs.add(_(
                    "The recipient bank account linked to this invoice is archived.\n"
                    "So you cannot confirm the invoice."
                ))
            if float_compare(invoice.amount_total, 0.0, precision_rounding=invoice.currency_id.rounding) < 0:
                validation_msgs.add(_(
                    "You cannot validate an invoice with a negative total amount. "
                    "You should create a credit note instead. "
                    "Use the action menu to transform it into a credit note or refund."
                ))

            if not invoice.partner_id:
                if invoice.is_sale_document():
                    validation_msgs.add(_("The field 'Customer' is required, please complete it to validate the Customer Invoice."))
                elif invoice.is_purchase_document():
                    validation_msgs.add(_("The field 'Vendor' is required, please complete it to validate the Vendor Bill."))

            # Handle case when the invoice_date is not set. In that case, the invoice_date is set at today and then,
            # lines are recomputed accordingly.
            if not invoice.invoice_date:
                if invoice.is_sale_document(include_receipts=True):
                    invoice.invoice_date = fields.Date.context_today(self)
                elif invoice.is_purchase_document(include_receipts=True):
                    validation_msgs.add(_("The Bill/Refund date is required to validate this document."))

        for move in self:
            if move.state in ['posted', 'cancel']:
                validation_msgs.add(_('The entry %(name)s (id %(id)s) must be in draft.', name=move.name, id=move.id))
            if not move.line_ids.filtered(lambda line: line.display_type not in ('line_section', 'line_note')):
                validation_msgs.add(_('You need to add a line before posting.'))
            if not soft and move.auto_post != 'no' and move.date > fields.Date.context_today(self):
                date_msg = move.date.strftime(get_lang(self.env).date_format)
                validation_msgs.add(_("This move is configured to be auto-posted on %(date)s", date=date_msg))
            if not move.journal_id.active:
                validation_msgs.add(_(
                    "You cannot post an entry in an archived journal (%(journal)s)",
                    journal=move.journal_id.display_name,
                ))
            if move.display_inactive_currency_warning:
                validation_msgs.add(_(
                    "You cannot validate a document with an inactive currency: %s",
                    move.currency_id.name
                ))

            if move.line_ids.account_id.filtered(lambda account: account.deprecated) and not self._context.get('skip_account_deprecation_check'):
                validation_msgs.add(_("A line of this move is using a deprecated account, you cannot post it."))

        if validation_msgs:
            msg = "\n".join([line for line in validation_msgs])
            raise UserError(msg)

        if soft:
            future_moves = self.filtered(lambda move: move.date > fields.Date.context_today(self))
            for move in future_moves:
                if move.auto_post == 'no':
                    move.auto_post = 'at_date'
                msg = _('This move will be posted at the accounting date: %(date)s', date=format_date(self.env, move.date))
                move.message_post(body=msg)
            to_post = self - future_moves
        else:
            to_post = self

        for move in to_post:
            affects_tax_report = move._affect_tax_report()
            lock_dates = move._get_violated_lock_dates(move.date, affects_tax_report)
            if lock_dates:
                move.date = move._get_accounting_date(move.invoice_date or move.date, affects_tax_report)

        # Create the analytic lines in batch is faster as it leads to less cache invalidation.
        to_post.line_ids._create_analytic_lines()

        # Trigger copying for recurring invoices
        to_post.filtered(lambda m: m.auto_post not in ('no', 'at_date'))._copy_recurring_entries()

        for invoice in to_post:
            # Fix inconsistencies that may occure if the OCR has been editing the invoice at the same time of a user. We force the
            # partner on the lines to be the same as the one on the move, because that's the only one the user can see/edit.
            wrong_lines = invoice.is_invoice() and invoice.line_ids.filtered(lambda aml:
                aml.partner_id != invoice.commercial_partner_id
                and aml.display_type not in ('line_note', 'line_section')
            )
            if wrong_lines:
                wrong_lines.write({'partner_id': invoice.commercial_partner_id.id})

        # reconcile if state is in draft and move has reversal_entry_id set
        draft_reverse_moves = to_post.filtered(lambda move: move.reversed_entry_id and move.reversed_entry_id.state == 'posted')

        to_post.write({
            'state': 'posted',
            'posted_before': True,
        })

        draft_reverse_moves.reversed_entry_id._reconcile_reversed_moves(draft_reverse_moves, self._context.get('move_reverse_cancel', False))
        to_post.line_ids._reconcile_marked()

        for invoice in to_post:
            invoice.message_subscribe([
                p.id
                for p in [invoice.partner_id]
                if p not in invoice.sudo().message_partner_ids
            ])

        customer_count, supplier_count = defaultdict(int), defaultdict(int)
        for invoice in to_post:
            if invoice.is_sale_document():
                customer_count[invoice.partner_id] += 1
            elif invoice.is_purchase_document():
                supplier_count[invoice.partner_id] += 1
            elif invoice.move_type == 'entry':
                sale_amls = invoice.line_ids.filtered(lambda line: line.partner_id and line.account_id.account_type == 'asset_receivable')
                for partner in sale_amls.mapped('partner_id'):
                    customer_count[partner] += 1
                purchase_amls = invoice.line_ids.filtered(lambda line: line.partner_id and line.account_id.account_type == 'liability_payable')
                for partner in purchase_amls.mapped('partner_id'):
                    supplier_count[partner] += 1
        for partner, count in customer_count.items():
            (partner | partner.commercial_partner_id)._increase_rank('customer_rank', count)
        for partner, count in supplier_count.items():
            (partner | partner.commercial_partner_id)._increase_rank('supplier_rank', count)

        # Trigger action for paid invoices if amount is zero
        to_post.filtered(
            lambda m: m.is_invoice(include_receipts=True) and m.currency_id.is_zero(m.amount_total)
        )._invoice_paid_hook()

        return to_post

    def _set_next_made_sequence_gap(self, made_gap: bool):
        """Update the field made_sequence_gap on the next moves of the current ones.

        Either:
        - we changed something related to the sequence on the current moves, so we need to set the
          sequence as broken on the next moves before updating (made_gap=True)
        - we are filling a gap, so we need to update the next move to remove the flag (made_gap=False)
        """
        next_moves = self.browse()
        named = self.filtered(lambda m: m.name and m.name != '/')
        for (journal, prefix), moves in named.grouped(lambda move: (move.journal_id, move.sequence_prefix)).items():
            next_moves += self.env['account.move'].sudo().search([
                ('journal_id', '=', journal.id),
                ('sequence_prefix', '=', prefix),
                ('sequence_number', 'in', [move.sequence_number + 1 for move in moves]),
            ])
        next_moves.made_sequence_gap = made_gap

    def _find_and_set_purchase_orders(self, po_references, partner_id, amount_total, from_ocr=False, timeout=10):
        # hook to be used with purchase, so that vendor bills are sync/autocompleted with purchase orders
        self.ensure_one()

    def _link_bill_origin_to_purchase_orders(self, timeout=10):
        for move in self.filtered(lambda m: m.move_type in self.get_purchase_types()):
            references = [move.invoice_origin] if move.invoice_origin else []
            move._find_and_set_purchase_orders(references, move.partner_id.id, move.amount_total, timeout=timeout)
        return self

    # -------------------------------------------------------------------------
    # PUBLIC ACTIONS
    # -------------------------------------------------------------------------

    def open_reconcile_view(self):
        return self.line_ids.open_reconcile_view()

    def action_open_business_doc(self):
        self.ensure_one()
        if self.payment_id:
            name = _("Payment")
            res_model = 'account.payment'
            res_id = self.payment_id.id
        elif self.statement_line_id:
            name = _("Bank Transaction")
            res_model = 'account.bank.statement.line'
            res_id = self.statement_line_id.id
        else:
            name = _("Journal Entry")
            res_model = 'account.move'
            res_id = self.id

        return {
            'name': name,
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'views': [(False, 'form')],
            'res_model': res_model,
            'res_id': res_id,
            'target': 'current',
        }

    def action_update_fpos_values(self):
        self.invoice_line_ids._compute_tax_ids()
        self.line_ids._compute_account_id()

    def open_created_caba_entries(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _("Cash Basis Entries"),
            'res_model': 'account.move',
            'view_mode': 'form',
            'domain': [('id', 'in', self.tax_cash_basis_created_move_ids.ids)],
            'views': [(self.env.ref('account.view_move_tree').id, 'tree'), (False, 'form')],
        }

    def action_switch_move_type(self):
        if any(move.posted_before for move in self):
            raise ValidationError(_("You cannot switch the type of a posted document."))
        if any(move.move_type == "entry" for move in self):
            raise ValidationError(_("This action isn't available for this document."))

        for move in self:
            in_out, old_move_type = move.move_type.split('_')
            new_move_type = f"{in_out}_{'invoice' if old_move_type == 'refund' else 'refund'}"
            values = {
                'name': False,
                'move_type': new_move_type,
                'partner_bank_id': False,
            }
            if move.amount_total < 0:
                values['line_ids'] = [
                    Command.update(line.id, {'quantity': -line.quantity})
                    for line in move.line_ids
                    if line.display_type == 'product'
                ]
            move.write(values)

    def action_register_payment(self):
        return self.line_ids.action_register_payment()

    def action_duplicate(self):
        # offer the possibility to duplicate thanks to a button instead of a hidden menu, which is more visible
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id("account.action_move_journal_line")
        action['context'] = dict(self.env.context)
        action['context']['view_no_maturity'] = False
        action['views'] = [(self.env.ref('account.view_move_form').id, 'form')]
        action['res_id'] = self.copy().id
        return action

    def action_send_and_print(self):
        template = self.env.ref(self._get_mail_template(), raise_if_not_found=False)

        if any(not x.is_sale_document(include_receipts=True) for x in self):
            raise UserError(_("You can only send sales documents"))

        return {
            'name': _("Send"),
            'type': 'ir.actions.act_window',
            'view_type': 'form',
            'view_mode': 'form',
            'res_model': 'account.move.send',
            'target': 'new',
            'context': {
                'active_ids': self.ids,
                'default_mail_template_id': template and template.id or False,
            },
        }

    def action_invoice_sent(self):
        """ Open a window to compose an email, with the edi invoice template
            message loaded by default
        """
        self.ensure_one()

        report_action = self.action_send_and_print()
        if self.env.is_admin() and not self.env.company.external_report_layout_id and not self.env.context.get('discard_logo_check'):
            report_action = self.env['ir.actions.report']._action_configure_external_report_layout(report_action, "account.action_base_document_layout_configurator")
            report_action['context']['default_from_invoice'] = self.move_type == 'out_invoice'

        return report_action

    def preview_invoice(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_url',
            'target': 'self',
            'url': self.get_portal_url(),
        }

    def action_reverse(self):
        action = self.env["ir.actions.actions"]._for_xml_id("account.action_view_account_move_reversal")

        if self.is_invoice():
            action['name'] = _('Credit Note')

        return action

    def action_post(self):
        moves_with_payments = self.filtered('payment_id')
        if moves_with_payments:
            moves_with_payments.payment_id.action_post()
        other_moves = self - moves_with_payments
        # Disabled by default to avoid breaking automated action flow
        if (
            not self.env.context.get('disable_abnormal_invoice_detection', True)
            and other_moves.filtered(lambda m: m.abnormal_amount_warning or m.abnormal_date_warning)
        ):
            return {
                'name': _("Confirm Entries"),
                'type': 'ir.actions.act_window',
                'res_model': 'validate.account.move',
                'view_mode': 'form',
                'context': {'default_move_ids': other_moves.ids},
                'target': 'new',
            }
        if other_moves:
            other_moves._post(soft=False)
        return False

    def js_assign_outstanding_line(self, line_id):
        ''' Called by the 'payment' widget to reconcile a suggested journal item to the present
        invoice.

        :param line_id: The id of the line to reconcile with the current invoice.
        '''
        self.ensure_one()
        lines = self.env['account.move.line'].browse(line_id)
        lines += self.line_ids.filtered(lambda line: line.account_id == lines[0].account_id and not line.reconciled)
        return lines.reconcile()

    def js_remove_outstanding_partial(self, partial_id):
        ''' Called by the 'payment' widget to remove a reconciled entry to the present invoice.

        :param partial_id: The id of an existing partial reconciled with the current invoice.
        '''
        self.ensure_one()
        partial = self.env['account.partial.reconcile'].browse(partial_id)
        return partial.unlink()

    def button_set_checked(self):
        for move in self:
            move.to_check = False

    def button_draft(self):
        if any(move.state not in ('cancel', 'posted') for move in self):
            raise UserError(_("Only posted/cancelled journal entries can be reset to draft."))
        if any(move.need_cancel_request for move in self):
            raise UserError(_("You can't reset to draft those journal entries. You need to request a cancellation instead."))

        self._check_draftable()
        # We remove all the analytics entries for this journal
        self.mapped('line_ids.analytic_line_ids').unlink()
        self.mapped('line_ids').remove_move_reconcile()
        self.state = 'draft'

    def _check_draftable(self):
        exchange_move_ids = set()
        if self:
            self.env['account.full.reconcile'].flush_model(['exchange_move_id'])
            self.env['account.partial.reconcile'].flush_model(['exchange_move_id'])
            sql = SQL(
                """
                    SELECT DISTINCT sub.exchange_move_id
                    FROM (
                        SELECT exchange_move_id
                        FROM account_full_reconcile
                        WHERE exchange_move_id IN %s

                        UNION ALL

                        SELECT exchange_move_id
                        FROM account_partial_reconcile
                        WHERE exchange_move_id IN %s
                    ) AS sub
                """,
                tuple(self.ids), tuple(self.ids),
            )
            exchange_move_ids = {id_ for id_, in self.env.execute_query(sql)}

        for move in self:
            if move.id in exchange_move_ids:
                raise UserError(_('You cannot reset to draft an exchange difference journal entry.'))
            if move.tax_cash_basis_rec_id or move.tax_cash_basis_origin_move_id:
                # If the reconciliation was undone, move.tax_cash_basis_rec_id will be empty;
                # but we still don't want to allow setting the caba entry to draft
                # (it'll have been reversed automatically, so no manual intervention is required),
                # so we also check tax_cash_basis_origin_move_id, which stays unchanged
                # (we need both, as tax_cash_basis_origin_move_id did not exist in older versions).
                raise UserError(_('You cannot reset to draft a tax cash basis journal entry.'))
            if move.inalterable_hash:
                raise UserError(_('You cannot modify a sent entry of this journal because it is in strict mode.'))

    def button_hash(self):
        self._hash_moves(force_hash=True)

    def button_request_cancel(self):
        """ Hook allowing the localizations to request a cancellation from the government before cancelling the invoice. """
        self.ensure_one()
        if not self.need_cancel_request:
            raise UserError(_("You can only request a cancellation for invoice sent to the government."))

    def button_cancel(self):
        # Shortcut to move from posted to cancelled directly. This is useful for E-invoices that must not be changed
        # when sent to the government.
        moves_to_reset_draft = self.filtered(lambda x: x.state == 'posted')
        if moves_to_reset_draft:
            moves_to_reset_draft.button_draft()

        if any(move.state != 'draft' for move in self):
            raise UserError(_("Only draft journal entries can be cancelled."))

        self.write({'auto_post': 'no', 'state': 'cancel'})

    def action_activate_currency(self):
        self.currency_id.filtered(lambda currency: not currency.active).write({'active': True})

    def _get_mail_template(self):
        """
        :return: the correct mail template based on the current move type
        """
        return (
            'account.email_template_edi_credit_note'
            if all(move.move_type == 'out_refund' for move in self)
            else 'account.email_template_edi_invoice'
        )

    def _notify_get_recipients_groups(self, message, model_description, msg_vals=None):
        groups = super()._notify_get_recipients_groups(message, model_description, msg_vals=msg_vals)
        self.ensure_one()

        if self.move_type != 'entry':
            local_msg_vals = dict(msg_vals or {})
            self._portal_ensure_token()
            access_link = self._notify_get_action_link('view', **local_msg_vals, access_token=self.access_token)

            # Create a new group for partners that have been manually added as recipients.
            # Those partners should have access to the invoice.
            button_access = {'url': access_link} if access_link else {}
            recipient_group = (
                'additional_intended_recipient',
                lambda pdata: pdata['id'] in local_msg_vals.get('partner_ids', []) and pdata['id'] != self.partner_id.id,
                {
                    'has_button_access': True,
                    'button_access': button_access,
                }
            )
            groups.insert(0, recipient_group)

        return groups

    def _get_report_base_filename(self):
        return self._get_move_display_name()

    # -------------------------------------------------------------------------
    # CRON
    # -------------------------------------------------------------------------

    def _autopost_draft_entries(self):
        ''' This method is called from a cron job.
        It is used to post entries such as those created by the module
        account_asset and recurring entries created in _post().
        '''
        moves = self.search([
            ('state', '=', 'draft'),
            ('date', '<=', fields.Date.context_today(self)),
            ('auto_post', '!=', 'no'),
            ('to_check', '=', False),
        ], limit=100)

        try:  # try posting in batch
            with self.env.cr.savepoint():
                moves._post()
        except UserError:  # if at least one move cannot be posted, handle moves one by one
            for move in moves:
                try:
                    with self.env.cr.savepoint():
                        move._post()
                except UserError as e:
                    move.to_check = True
                    msg = _('The move could not be posted for the following reason: %(error_message)s', error_message=e)
                    move.message_post(body=msg, message_type='comment')

        if len(moves) == 100:  # assumes there are more whenever search hits limit
            self.env.ref('account.ir_cron_auto_post_draft_entry')._trigger()

    @api.model
    def _cron_account_move_send(self, job_count=10):
        """ Handle Send & Print async processing.
        :param job_count: maximum number of jobs to process if specified.
        """
        def get_account_notification(partner, moves, is_success):
            return [
                partner,
                'account_notification',
                {
                    'type': 'success' if is_success else 'warning',
                    'title': _('Invoices sent') if is_success else _('Invoices in error'),
                    'message': _('Invoices sent successfully.') if is_success else _(
                        "One or more invoices couldn't be processed."),
                    'action_button': {
                        'name': _('Open'),
                        'action_name': _('Sent invoices') if is_success else _('Invoices in error'),
                        'model': 'account.move',
                        'res_ids': moves.ids,
                    },
                },
            ]

        limit = job_count + 1
        to_process = self.env['account.move'].search(
            [('send_and_print_values', '!=', False)],
            limit=limit,
        )
        need_retrigger = len(to_process) > job_count
        if not to_process:
            return

        all_moves = to_process[:job_count]
        for _company, moves in all_moves.grouped('company_id').items():
            try:
                # Lock moves
                with self.env.cr.savepoint(flush=False):
                    self._cr.execute('SELECT * FROM account_move WHERE id IN %s FOR UPDATE NOWAIT', [tuple(moves.ids)])

            except psycopg2.errors.LockNotAvailable:
                _logger.debug('Another transaction already locked documents rows. Cannot process documents.')
                continue

            # Collect moves by res.partner that executed the Send & Print wizard, must be done before the _process
            # that modify send_and_print_values.
            moves_by_partner = moves.grouped(lambda m: m.send_and_print_values['sp_partner_id'])

            self.env['account.move.send']._process_send_and_print(moves)

            notifications = []
            for partner_id, partner_moves in moves_by_partner.items():
                partner = self.env['res.partner'].browse(partner_id)
                partner_moves_error = partner_moves.filtered(lambda m: m.send_and_print_values and m.send_and_print_values.get('error'))
                if partner_moves_error:
                    notifications.append(get_account_notification(partner, partner_moves_error, False))
                partner_moves_success = partner_moves - partner_moves_error
                if partner_moves_success:
                    notifications.append(get_account_notification(partner, partner_moves_success, True))
                partner_moves_error.send_and_print_values = False

            self.env['bus.bus']._sendmany(notifications)

        if need_retrigger:
            self.env.ref('account.ir_cron_account_move_send')._trigger()

    # -------------------------------------------------------------------------
    # HELPER METHODS
    # -------------------------------------------------------------------------

    @api.model
    def get_invoice_types(self, include_receipts=False):
        return self.get_sale_types(include_receipts) + self.get_purchase_types(include_receipts)

    def is_invoice(self, include_receipts=False):
        return self.is_sale_document(include_receipts) or self.is_purchase_document(include_receipts)

    def is_entry(self):
        return self.move_type == 'entry'

    @api.model
    def get_sale_types(self, include_receipts=False):
        return ['out_invoice', 'out_refund'] + (include_receipts and ['out_receipt'] or [])

    def is_sale_document(self, include_receipts=False):
        return self.move_type in self.get_sale_types(include_receipts)

    @api.model
    def get_purchase_types(self, include_receipts=False):
        return ['in_invoice', 'in_refund'] + (include_receipts and ['in_receipt'] or [])

    def is_purchase_document(self, include_receipts=False):
        return self.move_type in self.get_purchase_types(include_receipts)

    @api.model
    def get_inbound_types(self, include_receipts=True):
        return ['out_invoice', 'in_refund'] + (include_receipts and ['out_receipt'] or [])

    def is_inbound(self, include_receipts=True):
        return self.move_type in self.get_inbound_types(include_receipts)

    @api.model
    def get_outbound_types(self, include_receipts=True):
        return ['in_invoice', 'out_refund'] + (include_receipts and ['in_receipt'] or [])

    def is_outbound(self, include_receipts=True):
        return self.move_type in self.get_outbound_types(include_receipts)

    def _get_accounting_date(self, invoice_date, has_tax):
        """Get correct accounting date for previous periods, taking tax lock date into account.
        When registering an invoice in the past, we still want the sequence to be increasing.
        We then take the last day of the period, depending on the sequence format.

        If there is a tax lock date and there are taxes involved, we register the invoice at the
        last date of the first open period.
        :param invoice_date (datetime.date): The invoice date
        :param has_tax (bool): Iff any taxes are involved in the lines of the invoice
        :return (datetime.date):
        """
        lock_dates = self._get_violated_lock_dates(invoice_date, has_tax)
        today = fields.Date.context_today(self)
        highest_name = self.highest_name or self._get_last_sequence(relaxed=True)
        number_reset = self._deduce_sequence_number_reset(highest_name)
        if lock_dates:
            invoice_date = lock_dates[-1][0] + timedelta(days=1)
        if self.is_sale_document(include_receipts=True):
            if lock_dates:
                if not highest_name or number_reset == 'month':
                    return min(today, date_utils.get_month(invoice_date)[1])
                elif number_reset == 'year':
                    return min(today, date_utils.end_of(invoice_date, 'year'))
        else:
            if not highest_name or number_reset == 'month':
                if (today.year, today.month) > (invoice_date.year, invoice_date.month):
                    return date_utils.get_month(invoice_date)[1]
                else:
                    return max(invoice_date, today)
            elif number_reset == 'year':
                if today.year > invoice_date.year:
                    return date(invoice_date.year, 12, 31)
                else:
                    return max(invoice_date, today)
        return invoice_date

    def _get_violated_lock_dates(self, invoice_date, has_tax):
        """Get all the lock dates affecting the current invoice_date.
        :param invoice_date: The invoice date
        :param has_tax: If any taxes are involved in the lines of the invoice
        :return: a list of tuples containing the lock dates affecting this move, ordered chronologically.
        """
        return self.company_id._get_violated_lock_dates(invoice_date, has_tax)

    def _get_lock_date_message(self, invoice_date, has_tax):
        """Get a message describing the latest lock date affecting the specified date.
        :param invoice_date: The date to be checked
        :param has_tax: If any taxes are involved in the lines of the invoice
        :return: a message describing the latest lock date affecting this move and the date it will be
                 accounted on if posted, or False if no lock dates affect this move.
        """
        lock_dates = self._get_violated_lock_dates(invoice_date, has_tax)
        if lock_dates:
            invoice_date = self._get_accounting_date(invoice_date, has_tax)
            lock_date, lock_type = lock_dates[-1]
            tax_lock_date_message = _(
                "The date is being set prior to the %(lock_type)s lock date %(lock_date)s. "
                "The Journal Entry will be accounted on %(invoice_date)s upon posting.",
                lock_type=lock_type,
                lock_date=format_date(self.env, lock_date),
                invoice_date=format_date(self.env, invoice_date))
            return tax_lock_date_message
        return False

    @api.model
    def _move_dict_to_preview_vals(self, move_vals, currency_id=None):
        preview_vals = {
            'group_name': "%s, %s" % (format_date(self.env, move_vals['date']) or _('[Not set]'), move_vals['ref']),
            'items_vals': move_vals['line_ids'],
        }
        for line in preview_vals['items_vals']:
            if 'partner_id' in line[2]:
                # sudo is needed to compute display_name in a multi companies environment
                line[2]['partner_id'] = self.env['res.partner'].browse(line[2]['partner_id']).sudo().display_name
            line[2]['account_id'] = self.env['account.account'].browse(line[2]['account_id']).display_name or _('Destination Account')
            line[2]['debit'] = currency_id and formatLang(self.env, line[2]['debit'], currency_obj=currency_id) or line[2]['debit']
            line[2]['credit'] = currency_id and formatLang(self.env, line[2]['credit'], currency_obj=currency_id) or line[2]['debit']
        return preview_vals

    def _generate_qr_code(self, silent_errors=False):
        """ Generates and returns a QR-code generation URL for this invoice,
        raising an error message if something is misconfigured.

        The chosen QR generation method is the one set in qr_method field if there is one,
        or the first eligible one found. If this search had to be performed and
        and eligible method was found, qr_method field is set to this method before
        returning the URL. If no eligible QR method could be found, we return None.
        """
        self.ensure_one()

        if not self.display_qr_code:
            return None

        qr_code_method = self.qr_code_method
        if qr_code_method:
            # If the user set a qr code generator manually, we check that we can use it
            error_msg = self.partner_bank_id._get_error_messages_for_qr(self.qr_code_method, self.partner_id, self.currency_id)
            if error_msg:
                raise UserError(error_msg)
        else:
            # Else we find one that's eligible and assign it to the invoice
            for candidate_method, _candidate_name in self.env['res.partner.bank'].get_available_qr_methods_in_sequence():
                error_msg = self.partner_bank_id._get_error_messages_for_qr(candidate_method, self.partner_id, self.currency_id)
                if not error_msg:
                    qr_code_method = candidate_method
                    break

        if not qr_code_method:
            # No eligible method could be found; we can't generate the QR-code
            return None

        unstruct_ref = self.ref if self.ref else self.name
        rslt = self.partner_bank_id.build_qr_code_base64(self.amount_residual, unstruct_ref, self.payment_reference, self.currency_id, self.partner_id, qr_code_method, silent_errors=silent_errors)

        # We only set qr_code_method after generating the url; otherwise, it
        # could be set even in case of a failure in the QR code generation
        # (which would change the field, but not refresh UI, making the displayed data inconsistent with db)
        self.qr_code_method = qr_code_method

        return rslt

    def _get_pdf_and_send_invoice_vals(self, template, **kwargs):
        return {
            'mail_template_id': template.id,
            'move_ids': self.ids,
            'checkbox_send_mail': True,
            'checkbox_download': False,
            **kwargs,
        }

    def _generate_pdf_and_send_invoice(self, template, force_synchronous=True, allow_fallback_pdf=True, bypass_download=False, **kwargs):
        """ Generate the pdf for the current invoices and send them by mail using the send & print wizard.
        :param force_synchronous:   Flag indicating if the method should be done synchronously.
        :param allow_fallback_pdf:  In case of error when generating the documents for invoices, generate a
                                    proforma PDF report instead.
        :param bypass_download: Don't trigger the action from action_send_and_print and get generated attachments_ids instead.
        """
        composer_vals = self._get_pdf_and_send_invoice_vals(template, **kwargs)
        composer = self.env['account.move.send'].create(composer_vals)
        return composer.action_send_and_print(force_synchronous=force_synchronous, allow_fallback_pdf=allow_fallback_pdf, bypass_download=bypass_download)

    def _get_invoice_legal_documents(self):
        """ Return existing attachments or a temporary Pro Forma pdf. """
        self.ensure_one()
        if self.invoice_pdf_report_id:
            attachments = self.env['account.move.send']._get_invoice_extra_attachments(self)
        else:
            content, _ = self.env['ir.actions.report']._pre_render_qweb_pdf('account.account_invoices', self.ids, data={'proforma': True})
            attachments = self.env['ir.attachment'].new({
                'raw': content[self.id],
                'name': self._get_invoice_proforma_pdf_report_filename(),
                'mimetype': 'application/pdf',
                'res_model': self._name,
                'res_id': self.id,
            })
        return attachments

    def get_invoice_pdf_report_attachment(self):
        if len(self) < 2 and self.invoice_pdf_report_id:
            # if the Send & Print succeeded
            return self.invoice_pdf_report_id.raw, self.invoice_pdf_report_id.name
        elif len(self) < 2 and self.message_main_attachment_id:
            # if the Send & Print failed with fallback=True -> proforma PDF
            return self.message_main_attachment_id.raw, self.message_main_attachment_id.name
        # all other cases
        pdf_content = self.env['ir.actions.report']._render('account.account_invoices', self.ids)[0]
        pdf_name = self._get_invoice_report_filename() if len(self) == 1 else "Invoices.pdf"
        return pdf_content, pdf_name

    def _get_invoice_report_filename(self, extension='pdf'):
        """ Get the filename of the generated invoice report with extension file. """
        self.ensure_one()
        return f"{self.name.replace('/', '_')}.{extension}"

    def _get_invoice_proforma_pdf_report_filename(self):
        """ Get the filename of the generated proforma PDF invoice report. """
        self.ensure_one()
        return f"{self.name.replace('/', '_')}_proforma.pdf"

    def _prepare_edi_vals_to_export(self):
        ''' The purpose of this helper is to prepare values in order to export an invoice through the EDI system.
        This includes the computation of the tax details for each invoice line that could be very difficult to
        handle regarding the computation of the base amount.

        :return: A python dict containing default pre-processed values.
        '''
        self.ensure_one()

        res = {
            'record': self,
            'balance_multiplicator': -1 if self.is_inbound() else 1,
            'invoice_line_vals_list': [],
        }

        # Invoice lines details.
        for index, line in enumerate(self.invoice_line_ids.filtered(lambda line: line.display_type == 'product'), start=1):
            line_vals = line._prepare_edi_vals_to_export()
            line_vals['index'] = index
            res['invoice_line_vals_list'].append(line_vals)

        # Totals.
        res.update({
            'total_price_subtotal_before_discount': sum(x['price_subtotal_before_discount'] for x in res['invoice_line_vals_list']),
            'total_price_discount': sum(x['price_discount'] for x in res['invoice_line_vals_list']),
        })

        return res

    def _get_discount_allocation_account(self):
        if self.is_sale_document(include_receipts=True) and self.company_id.account_discount_expense_allocation_id:
            return self.company_id.account_discount_expense_allocation_id
        if self.is_purchase_document(include_receipts=True) and self.company_id.account_discount_income_allocation_id:
            return self.company_id.account_discount_income_allocation_id
        return None

    # -------------------------------------------------------------------------
    # TOOLING
    # -------------------------------------------------------------------------

    @api.model
    def _field_will_change(self, record, vals, field_name):
        if field_name not in vals:
            return False
        field = record._fields[field_name]
        if field.type == 'many2one':
            return record[field_name].id != vals[field_name]
        if field.type == 'many2many':
            current_ids = set(record[field_name].ids)
            after_write_ids = set(record.new({field_name: vals[field_name]})[field_name].ids)
            return current_ids != after_write_ids
        if field.type == 'one2many':
            return True
        if field.type == 'monetary' and record[field.get_currency_field(record)]:
            return not record[field.get_currency_field(record)].is_zero(record[field_name] - vals[field_name])
        if field.type == 'float':
            record_value = field.convert_to_cache(record[field_name], record)
            to_write_value = field.convert_to_cache(vals[field_name], record)
            return record_value != to_write_value
        return record[field_name] != vals[field_name]

    @api.model
    def _cleanup_write_orm_values(self, record, vals):
        cleaned_vals = dict(vals)
        for field_name in vals.keys():
            if not self._field_will_change(record, vals, field_name):
                del cleaned_vals[field_name]
        return cleaned_vals

    @contextmanager
    def _disable_recursion(self, container, key, default=None, target=True):
        """Apply the context key to all environments inside this context manager.

        If this context key is already set on the recordsets, yield `True`.
        The recordsets modified are the one in the container, as well as all the
        `self` recordsets of the calling stack.
        This more or less gives the wanted context to all records inside of the
        context manager.

        :param container: A mutable dict that needs to at least contain the key
                          `records`. Can contain other items if changing the env
                          is needed.
        :param key: The context key to apply to the recordsets.
        :param default: the default value of the context key, if it isn't defined
                        yet in the context
        :param target: the value of the context key meaning that we shouldn't
                       recurse
        :return: True iff we should just exit the context manager
        """

        disabled = container['records'].env.context.get(key, default) == target
        previous_values = {}
        previous_envs = set(self.env.transaction.envs)
        if not disabled:  # it wasn't disabled yet, disable it now
            for env in self.env.transaction.envs:
                previous_values[env] = env.context.get(key, EMPTY)
                env.context = frozendict({**env.context, key: target})
        try:
            yield disabled
        finally:
            for env, val in previous_values.items():
                if val != EMPTY:
                    env.context = frozendict({**env.context, key: val})
                else:
                    env.context = frozendict({k: v for k, v in env.context.items() if k != key})
            for env in (self.env.transaction.envs - previous_envs):
                if key in env.context:
                    env.context = frozendict({k: v for k, v in env.context.items() if k != key})

    # ------------------------------------------------------------
    # MAIL.THREAD
    # ------------------------------------------------------------

    def _mailing_get_default_domain(self, mailing):
        return ['&', ('move_type', '=', 'out_invoice'), ('state', '=', 'posted')]

    @api.model
    def _routing_check_route(self, message, message_dict, route, raise_exception=True):
        if route[0] == 'account.move' and len(message_dict['attachments']) < 1:
            # Don't create the move if no attachment.
            body = self.env['ir.qweb']._render('account.email_template_mail_gateway_failed', {
                'company_email': self.env.company.email,
                'company_name': self.env.company.name,
            })
            self._routing_create_bounce_email(message_dict['from'], body, message)
            return ()
        return super()._routing_check_route(message, message_dict, route, raise_exception=raise_exception)

    @api.model
    def message_new(self, msg_dict, custom_values=None):
        # EXTENDS mail mail.thread
        # Add custom behavior when receiving a new invoice through the mail's gateway.
        if (custom_values or {}).get('move_type', 'entry') not in ('out_invoice', 'in_invoice', 'entry'):
            return super().message_new(msg_dict, custom_values=custom_values)

        company = self.env['res.company'].browse(custom_values['company_id']) if custom_values.get('company_id') else self.env.company

        def is_internal_partner(partner):
            # Helper to know if the partner is an internal one.
            return partner == company.partner_id or (partner.user_ids and all(user._is_internal() for user in partner.user_ids))

        extra_domain = False
        if custom_values.get('company_id'):
            extra_domain = ['|', ('company_id', '=', custom_values['company_id']), ('company_id', '=', False)]

        # Search for partners in copy.
        cc_mail_addresses = email_split(msg_dict.get('cc', ''))
        followers = [partner for partner in self._mail_find_partner_from_emails(cc_mail_addresses, extra_domain=extra_domain) if partner]

        # Search for partner that sent the mail.
        from_mail_addresses = email_split(msg_dict.get('from', ''))
        senders = partners = [partner for partner in self._mail_find_partner_from_emails(from_mail_addresses, extra_domain=extra_domain) if partner]

        # Search for partners using the user.
        if not senders:
            senders = partners = list(self._mail_search_on_user(from_mail_addresses))

        if partners:
            # Check we are not in the case when an internal user forwarded the mail manually.
            if is_internal_partner(partners[0]):
                # Search for partners in the mail's body.
                body_mail_addresses = set(email_re.findall(msg_dict.get('body')))
                partners = [
                    partner
                    for partner in self._mail_find_partner_from_emails(body_mail_addresses, extra_domain=extra_domain)
                    if not is_internal_partner(partner) and partner.company_id.id in (False, company.id)
                ]
        # Little hack: Inject the mail's subject in the body.
        if msg_dict.get('subject') and msg_dict.get('body'):
            msg_dict['body'] = Markup('<div><div><h3>%s</h3></div>%s</div>') % (msg_dict['subject'], msg_dict['body'])

        # Create the invoice.
        values = {
            'name': '/',  # we have to give the name otherwise it will be set to the mail's subject
            'invoice_source_email': from_mail_addresses[0],
            'partner_id': partners and partners[0].id or False,
        }
        move_ctx = self.with_context(default_move_type=custom_values['move_type'], default_journal_id=custom_values['journal_id'])
        move = super(AccountMove, move_ctx).message_new(msg_dict, custom_values=values)
        move._compute_name()  # because the name is given, we need to recompute in case it is the first invoice of the journal

        # Assign followers.
        all_followers_ids = set(partner.id for partner in followers + senders + partners if is_internal_partner(partner))
        move.message_subscribe(list(all_followers_ids))
        return move

    def _message_post_after_hook(self, new_message, message_values):
        # EXTENDS mail mail.thread
        # When posting a message, check the attachment to see if it's an invoice and update with the imported data.
        res = super()._message_post_after_hook(new_message, message_values)

        attachments = new_message.attachment_ids
        if not attachments or self.env.context.get('no_new_invoice'):
            return res

        odoobot = self.env.ref('base.partner_root')
        if self.state != 'draft':
            self.message_post(body=_('The invoice is not a draft, it was not updated from the attachment.'),
                              message_type='comment',
                              subtype_xmlid='mail.mt_note',
                              author_id=odoobot.id)
            return res

        # As we are coming from the mail, we assume that ONE of the attachments
        # will enhance the invoice thanks to EDI / OCR / .. capabilities
        has_existing_lines = bool(self.invoice_line_ids)
        results = self._extend_with_attachments(attachments, new=bool(self._context.get('from_alias')))
        if has_existing_lines and not results:
            self.message_post(body=_('The invoice already contains lines, it was not updated from the attachment.'),
                              message_type='comment',
                              subtype_xmlid='mail.mt_note',
                              author_id=odoobot.id)
            return res
        attachments_per_invoice = defaultdict(self.env['ir.attachment'].browse)
        attachments_in_invoices = self.env['ir.attachment']
        for attachment, invoices in results.items():
            attachments_in_invoices += attachment
            invoices = invoices or self
            for invoice in invoices:
                attachments_per_invoice[invoice] |= attachment

        # Unlink the unused attachments
        (attachments - attachments_in_invoices).unlink()

        for invoice, attachments in attachments_per_invoice.items():
            if invoice == self:
                invoice.attachment_ids |= attachments
                new_message.attachment_ids = attachments.ids
                message_values.update({'res_id': self.id, 'attachment_ids': [Command.link(attachment.id) for attachment in attachments]})
                super(AccountMove, invoice)._message_post_after_hook(new_message, message_values)
            else:
                sub_new_message = new_message.copy({'attachment_ids': attachments.ids})
                sub_message_values = {
                    **message_values,
                    'res_id': invoice.id,
                    'attachment_ids': [Command.link(attachment.id) for attachment in attachments],
                }
                invoice.attachment_ids |= attachments
                invoice.message_ids = [Command.set(sub_new_message.id)]
                super(AccountMove, invoice)._message_post_after_hook(sub_new_message, sub_message_values)

        return res

    def _creation_subtype(self):
        # EXTENDS mail mail.thread
        if self.move_type in ('out_invoice', 'out_receipt'):
            return self.env.ref('account.mt_invoice_created')
        else:
            return super()._creation_subtype()

    def _track_subtype(self, init_values):
        # EXTENDS mail mail.thread
        # add custom subtype depending of the state.
        self.ensure_one()

        if not self.is_invoice(include_receipts=True):
            if self.payment_id and 'state' in init_values:
                self.payment_id._message_track(['state'], {self.payment_id.id: init_values})
            return super()._track_subtype(init_values)

        if 'payment_state' in init_values and self.payment_state == 'paid':
            return self.env.ref('account.mt_invoice_paid')
        elif 'state' in init_values and self.state == 'posted' and self.is_sale_document(include_receipts=True):
            return self.env.ref('account.mt_invoice_validated')
        return super()._track_subtype(init_values)

    def _creation_message(self):
        # EXTENDS mail mail.thread
        if not self.is_invoice(include_receipts=True):
            return super()._creation_message()
        return {
            'out_invoice': _('Invoice Created'),
            'out_refund': _('Credit Note Created'),
            'in_invoice': _('Vendor Bill Created'),
            'in_refund': _('Refund Created'),
            'out_receipt': _('Sales Receipt Created'),
            'in_receipt': _('Purchase Receipt Created'),
        }[self.move_type]

    def _notify_by_email_prepare_rendering_context(self, message, msg_vals=False, model_description=False,
                                                   force_email_company=False, force_email_lang=False):
        # EXTENDS mail mail.thread
        render_context = super()._notify_by_email_prepare_rendering_context(
            message, msg_vals, model_description=model_description,
            force_email_company=force_email_company, force_email_lang=force_email_lang
        )
        record = render_context['record']
        subtitles = [f"{record.name} - {record.partner_id.name}" if record.partner_id else record.name]
        if self.invoice_date_due and self.payment_state not in ('in_payment', 'paid'):
            subtitles.append(_('%(amount)s due\N{NO-BREAK SPACE}%(date)s',
                           amount=format_amount(self.env, self.amount_total, self.currency_id, lang_code=render_context.get('lang')),
                           date=format_date(self.env, self.invoice_date_due, lang_code=render_context.get('lang'))
                          ))
        else:
            subtitles.append(format_amount(self.env, self.amount_total, self.currency_id, lang_code=render_context.get('lang')))
        render_context['subtitles'] = subtitles
        return render_context

    def _get_mail_thread_data_attachments(self):
        res = super()._get_mail_thread_data_attachments()
        # else, attachments with 'res_field' get excluded
        return res | self.env['account.move.send']._get_invoice_extra_attachments(self)

    # -------------------------------------------------------------------------
    # TOOLING
    # -------------------------------------------------------------------------

    def _conditional_add_to_compute(self, fname, condition):
        field = self._fields[fname]
        to_reset = self.filtered(lambda move:
            condition(move)
            and not self.env.is_protected(field, move._origin)
            and (move._origin or not move[fname])
        )
        to_reset.invalidate_recordset([fname])
        self.env.add_to_compute(field, to_reset)

    # -------------------------------------------------------------------------
    # HOOKS
    # -------------------------------------------------------------------------

    def _action_invoice_ready_to_be_sent(self):
        """ Hook allowing custom code when an invoice becomes ready to be sent by mail to the customer.
        For example, when an EDI document must be sent to the government and be signed by it.
        """

    def _is_ready_to_be_sent(self):
        """ Helper telling if a journal entry is ready to be sent by mail to the customer.

        :return: True if the invoice is ready, False otherwise.
        """
        self.ensure_one()
        return True

    @contextmanager
    def _send_only_when_ready(self):
        moves_not_ready = self.filtered(lambda x: not x._is_ready_to_be_sent())

        try:
            yield
        finally:
            moves_now_ready = moves_not_ready.filtered(lambda x: x._is_ready_to_be_sent())
            if moves_now_ready:
                moves_now_ready._action_invoice_ready_to_be_sent()

    def _invoice_paid_hook(self):
        ''' Hook to be overrided called when the invoice moves to the paid state. '''

    def _get_lines_onchange_currency(self):
        # Override needed for COGS
        return self.line_ids

    @api.model
    def _get_invoice_in_payment_state(self):
        ''' Hook to give the state when the invoice becomes fully paid. This is necessary because the users working
        with only invoicing don't want to see the 'in_payment' state. Then, this method will be overridden in the
        accountant module to enable the 'in_payment' state. '''
        return 'paid'

    def _get_name_invoice_report(self):
        """ This method need to be inherit by the localizations if they want to print a custom invoice report instead of
        the default one. For example please review the l10n_ar module """
        self.ensure_one()
        return 'account.report_invoice_document'

    def _is_downpayment(self):
        ''' Return true if the invoice is a downpayment.
        Down-payments can be created from a sale order. This method is overridden in the sale order module.
        '''
        return False

    @api.model
    def get_invoice_localisation_fields_required_to_invoice(self, country_id):
        """ Returns the list of fields that needs to be filled when creating an invoice for the selected country.
        This is required for some flows that would allow a user to request an invoice from the portal.
        Using these, we can get their information and dynamically create form inputs based for the fields required legally for the company country_id.
        The returned fields must be of type ir.model.fields in order to handle translations

        :param country_id: The country for which we want the fields.
        :return: an array of ir.model.fields for which the user should provide values.
        """
        return []
