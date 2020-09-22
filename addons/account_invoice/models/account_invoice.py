# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.addons.account.models.orm_utils import OrmUtils
from odoo.tools.misc import formatLang


class AccountInvoice(models.Model):
    _name = "account.invoice"
    _inherit = ['portal.mixin', 'mail.thread']
    _inherits = {'account.move': 'move_id'}
    _description = "Invoice"
    _order = "date desc, name desc, id desc"
    _check_company_auto = True

    # == Business fields ==
    move_id = fields.Many2one(
        comodel_name='account.move',
        string='Journal Entry', required=True, readonly=True, ondelete='cascade', check_company=True)
    narration = fields.Text(
        string='Terms and Conditions',
        store=True, readonly=False,
        compute='_compute_narration')
    invoice_type = fields.Selection(
        selection=[
            ('out_invoice', 'Customer Invoice'),
            ('out_refund', 'Customer Credit Note'),
            ('in_invoice', 'Vendor Bill'),
            ('in_refund', 'Vendor Credit Note'),
            ('out_receipt', 'Sales Receipt'),
            ('in_receipt', 'Purchase Receipt'),
        ],
        string='Type',
        required=True, store=True, index=True, readonly=True, tracking=True, change_default=True,
        default='out_invoice')
    currency_id = fields.Many2one(
        comodel_name='res.currency',
        string='Currency',
        store=True, readonly=False, tracking=True,
        compute='_compute_currency_id')
    partner_id = fields.Many2one(
        comodel_name='res.partner',
        string='Partner',
        tracking=True, change_default=True, check_company=True)
    partner_bank_id = fields.Many2one(
        comodel_name='res.partner.bank',
        string="Recipient Bank",
        store=True, readonly=True, check_company=True,
        compute='_compute_partner_bank_id',
        help="Bank Account Number to which the invoice will be paid. A Company bank account if this is a Customer "
             "Invoice or Vendor Credit Note, otherwise a Partner bank account number.")
    fiscal_position_id = fields.Many2one(
        comodel_name='account.fiscal.position',
        string='Fiscal Position',
        store=True, readonly=False, check_company=True,
        compute='_compute_fiscal_position_id',
        domain="[('company_id', '=', company_id)]",
        help="Fiscal positions are used to adapt taxes and accounts for particular customers or sales orders/invoices. "
             "The default value comes from the customer.")
    invoice_payment_term_id = fields.Many2one(
        comodel_name='account.payment.term', string='Payment Terms',
        store=True, readonly=False, check_company=True,
        compute='_compute_invoice_payment_term_id')
    user_id = fields.Many2one(
        comodel_name='res.users',
        string='Salesperson',
        copy=False, tracking=True,
        default=lambda self: self.env.user)
    accounting_date = fields.Date(
        string='Accounting Date',
        store=True, readonly=False, index=True, copy=False,
        compute='_compute_accounting_date')
    invoice_date = fields.Date(
        string='Invoice/Bill Date',
        store=True, readonly=False, index=True, copy=False,
        compute='_compute_invoice_date')
    invoice_date_due = fields.Date(
        string='Due Date',
        store=True, readonly=False, index=True, copy=False,
        compute='_compute_invoice_date_due')
    invoice_origin = fields.Char(
        string="Source Document",
        readonly=True, tracking=True,
        help="The document(s) that generated the invoice.")
    invoice_incoterm_id = fields.Many2one(
        comodel_name='account.incoterms',
        string="Incoterm",
        store=True, readonly=False,
        compute='_compute_invoice_incoterm_id',
        help="International Commercial Terms are a series of predefined commercial terms used in international "
             "transactions.")
    payment_reference = fields.Char(
        string='Payment Reference',
        index=True, copy=False,
        help="The payment reference to set on invoices.")
    qr_code_method = fields.Selection(
        selection=lambda self: self.env['res.partner.bank'].get_available_qr_methods_in_sequence(),
        string="Payment QR-code",
        help="Type of QR-code to be generated for the payment of this invoice, when printing it. If left blank, the "
             "first available and usable method will be used.")
    amount_by_group = fields.Binary(
        string="Tax amount by group",
        compute='_compute_invoice_taxes_by_group',
        help='Edit Tax amounts if you encounter rounding issues.')

    # === Lines ===
    invoice_line_ids = fields.One2many(
        comodel_name='account.invoice.line', inverse_name='invoice_id',
        string="Invoice Lines")
    invoice_tax_line_ids = fields.One2many(
        comodel_name='account.invoice.tax', inverse_name='invoice_id',
        string="Invoice Tax Lines")
    invoice_pay_line_ids = fields.One2many(
        comodel_name='account.invoice.payment', inverse_name='invoice_id',
        string="Invoice Payment Term Lines")

    # === Amount fields ===
    amount_untaxed = fields.Monetary(
        string='Untaxed Amount',
        tracking=True,
        compute='_compute_amounts',
        currency_field='currency_id')
    amount_tax = fields.Monetary(
        string='Tax',
        compute='_compute_amounts',
        currency_field='currency_id')
    amount_total = fields.Monetary(
        string='Total',
        compute='_compute_amounts',
        currency_field='currency_id')
    amount_residual = fields.Monetary(
        string='Amount Due',
        compute='_compute_accounting_amount',
        currency_field='currency_id')
    payment_state = fields.Selection(
        selection=[
            ('not_paid', 'Not Paid'),
            ('in_payment', 'In Payment'),
            ('paid', 'Paid'),
            ('partial', 'Partially Paid'),
            ('reversed', 'Reversed'),
            ('invoicing_legacy', 'Invoicing App Legacy'),
        ],
        string="Payment Status",
        store=True, readonly=True, copy=False, tracking=True,
        compute='_compute_accounting_amount')

    # ==== Payment widget fields ====
    # invoice_outstanding_credits_debits_widget = fields.Text(groups="account.group_account_invoice,account.group_account_readonly",
    #     compute='_compute_payments_widget_to_reconcile_info')
    # invoice_has_outstanding = fields.Boolean(groups="account.group_account_invoice,account.group_account_readonly",
    #     compute='_compute_payments_widget_to_reconcile_info')
    # invoice_payments_widget = fields.Text(groups="account.group_account_invoice,account.group_account_readonly",
    #     compute='_compute_payments_widget_reconciled_info')

    # ==== Vendor bill fields ====
    invoice_vendor_bill_id = fields.Many2one(
        comodel_name='account.invoice',
        string='Vendor Bill',
        store=False, check_company=True,
        help="Auto-complete from a past bill.")
    invoice_source_email = fields.Char(
        string='Source Email',
        tracking=True)
    invoice_partner_display_name = fields.Char(
        store=True,
        compute='_compute_invoice_partner_display_info')

    # ==== Cash rounding fields ====
    invoice_cash_rounding_id = fields.Many2one(
        comodel_name='account.cash.rounding',
        string='Cash Rounding Method',
        help="Defines the smallest coinage of the currency that can be used to pay by cash.")

    # ==== Display purpose fields ====
    display_qr_code = fields.Boolean(
        string="Display QR-code",
        related='company_id.qr_code')
    invoice_filter_type_domain = fields.Char(
        compute='_compute_invoice_filter_type_domain',
        help="Technical field used to have a dynamic domain on journal / taxes in the form view.")
    bank_partner_id = fields.Many2one(
        comodel_name='res.partner',
        compute='_compute_bank_partner_id',
        help='Technical field to get the domain on the bank')
    # invoice_has_matching_suspense_amount = fields.Boolean(
    #     compute='_compute_has_matching_suspense_amount',
    #     groups='account.group_account_invoice,account.group_account_readonly',
    #     help="Technical field used to display an alert on invoices if there is at least a matching amount in any supsense account.")
    # tax_lock_date_message = fields.Char(
    #     compute='_compute_tax_lock_date_message',
    #     help="Technical field used to display a message when the invoice's accounting date is prior of the tax lock date.")
    # has_reconciled_entries = fields.Boolean(
    #     compute="_compute_has_reconciled_entries",
    #     help="Technical field to hide Reconciled Entries stat button.")
    # show_reset_to_draft_button = fields.Boolean(
    #     compute='_compute_show_reset_to_draft_button')
    # show_name_warning = fields.Boolean(
    #     compute='_compute_show_name_warning')

    # -------------------------------------------------------------------------
    # HELPERS
    # -------------------------------------------------------------------------

    def _is_sale_document(self):
        self.ensure_one()
        return self.invoice_type in ('out_invoice', 'out_refund', 'out_receipt')

    def _is_purchase_document(self):
        self.ensure_one()
        return self.invoice_type in ('in_invoice', 'in_refund', 'in_receipt')

    def _is_inbound(self):
        return self.invoice_type in ('out_invoice', 'in_refund', 'out_receipt')

    def _is_outbound(self):
        return self.invoice_type in ('in_invoice', 'out_refund', 'in_receipt')

    def _is_refund(self):
        return self.invoice_type in ('out_refund', 'in_refund')

    @api.model
    def _get_cash_rounding_tracked_fields(self):
        return ['invoice_cash_rounding_id']

    @api.model
    def _get_payment_terms_tracked_fields(self):
        return ['invoice_payment_term_id', 'invoice_date', 'invoice_date_due']

    # -------------------------------------------------------------------------
    # HOOKS
    # -------------------------------------------------------------------------

    def _get_invoice_delivery_partner_id(self):
        ''' Hook allowing to retrieve the right delivery address depending of installed modules.
        :return: A res.partner record's id representing the delivery address.
        '''
        self.ensure_one()
        return self.partner_id.address_get(['delivery'])['delivery']

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('invoice_type', 'partner_id')
    def _compute_narration(self):
        for invoice in self:
            use_invoice_terms = self.env['ir.config_parameter'].sudo().get_param('account.use_invoice_terms')
            if invoice._is_sale_document() and use_invoice_terms:
                invoice.narration = invoice.company_id.with_context(lang=self.partner_id.lang).invoice_terms
            else:
                invoice.narration = invoice.narration

    @api.depends('journal_id')
    def _compute_currency_id(self):
        for invoice in self:
            invoice.currency_id = invoice.journal_id.currency_id \
                                  or invoice.journal_id.company_id.currency_id \
                                  or self.env.company.currency_id

    @api.depends('invoice_type', 'partner_id', 'journal_id')
    def _compute_partner_bank_id(self):
        for invoice in self:
            if invoice._is_outbound():
                customer = invoice.partner_id
                if invoice.partner_bank_id.partner_id == customer:
                    invoice.partner_bank_id = invoice.partner_bank_id
                else:
                    invoice.partner_bank_id = customer.bank_ids[0] if customer.bank_ids else False
            else:
                company_partner = invoice.journal_id.company_id.partner_id
                if invoice.partner_bank_id.partner_id == company_partner:
                    invoice.partner_bank_id = invoice.partner_bank_id
                else:
                    invoice.partner_bank_id = company_partner.bank_ids[0] if company_partner.bank_ids else False

    @api.depends('company_id', 'partner_id')
    def _compute_fiscal_position_id(self):
        for invoice in self:
            invoice.fiscal_position_id = self.env['account.fiscal.position'].get_fiscal_position(
                invoice.partner_id.id,
                delivery_id=invoice._get_invoice_delivery_partner_id(),
            )

    @api.depends('partner_id')
    def _compute_invoice_payment_term_id(self):
        for invoice in self:
            invoice = invoice.with_company(invoice.company_id or self.env.company)
            if invoice._is_sale_document() and invoice.partner_id.property_payment_term_id:
                invoice.invoice_payment_term_id = invoice.partner_id.property_payment_term_id
            elif invoice._is_purchase_document() and invoice.partner_id.property_supplier_payment_term_id:
                invoice.invoice_payment_term_id = invoice.partner_id.property_supplier_payment_term_id
            else:
                invoice.invoice_payment_term_id = False

    @api.depends('invoice_date')
    def _compute_accounting_date(self):
        for invoice in self:
            invoice.accounting_date = invoice.invoice_date or fields.Date.context_today(invoice)

    @api.depends('invoice_type')
    def _compute_invoice_date(self):
        for invoice in self:
            if invoice.invoice_date:
                invoice.invoice_date = invoice.invoice_date
            elif invoice._is_purchase_document():
                invoice.invoice_date = fields.Date.context_today(invoice)
            else:
                invoice.invoice_date = False

    @api.depends('invoice_date', 'invoice_payment_term_id')
    def _compute_invoice_date_due(self):
        for invoice in self:
            if invoice.invoice_payment_term_id:
                invoice.invoice_date_due = invoice.invoice_date_due
            elif invoice.invoice_date:
                invoice.invoice_date_due = invoice.invoice_date
            else:
                invoice.invoice_date_due = fields.Date.context_today(invoice)

    @api.depends('company_id')
    def _compute_invoice_incoterm_id(self):
        for invoice in self:
            invoice.invoice_incoterm_id = invoice.company_id.incoterm_id

    @api.depends('invoice_line_ids.amount_untaxed', 'invoice_tax_line_ids.amount_tax')
    def _compute_amounts(self):
        for invoice in self:
            invoice.amount_untaxed = sum(invoice.invoice_line_ids.mapped('amount_untaxed'))
            invoice.amount_tax = sum(invoice.invoice_tax_line_ids.mapped('amount_tax'))
            invoice.amount_total = invoice.amount_untaxed + invoice.amount_tax

    def _compute_accounting_amount(self):
        for invoice in self:
            invoice.amount_residual = 0.0
            invoice.payment_state = 'not_paid'

    @api.depends('invoice_type')
    def _compute_invoice_filter_type_domain(self):
        for invoice in self:
            if invoice._is_sale_document():
                invoice.invoice_filter_type_domain = 'sale'
            else: # if invoice._is_purchase_document():
                invoice.invoice_filter_type_domain = 'purchase'

    @api.depends('partner_id', 'company_id')
    def _compute_bank_partner_id(self):
        for invoice in self:
            if invoice._is_outbound():
                invoice.bank_partner_id = invoice.partner_id.commercial_partner_id
            else:
                invoice.bank_partner_id = invoice.company_id.partner_id

    @api.depends('currency_id', 'partner_id', 'invoice_tax_line_ids.amount_tax', 'invoice_tax_line_ids.tax_base_amount')
    def _compute_invoice_taxes_by_group(self):
        for invoice in self:
            lang_env = invoice.with_context(lang=invoice.partner_id.lang).env
            res = {}
            for line in invoice.invoice_tax_line_ids:
                res.setdefault(line.tax_line_id.tax_group_id, {'base': 0.0, 'amount': 0.0})
                res[line.tax_line_id.tax_group_id]['base'] += line.tax_base_amount
                res[line.tax_line_id.tax_group_id]['amount'] += line.amount_tax

            res = sorted(res.items(), key=lambda l: l[0].sequence)
            invoice.amount_by_group = [(
                group.name,
                amounts['amount'],
                amounts['base'],
                formatLang(lang_env, amounts['amount'], currency_obj=invoice.currency_id),
                formatLang(lang_env, amounts['base'], currency_obj=invoice.currency_id),
                len(res),
                group.id,
            ) for group, amounts in res]

    # -------------------------------------------------------------------------
    # CONSTRAINT METHODS
    # -------------------------------------------------------------------------

    # -------------------------------------------------------------------------
    # SYNCHRONIZATION METHODS
    # -------------------------------------------------------------------------
    
    def _synchronize_move_from_invoice(self):
        self.ensure_one()
        vals = {
            'invoice_id': self.id,
            'narration': self.narration,
            'date': self.accounting_date,
            'line_ids': [],
        }
        for line in self.invoice_line_ids:
            if line.accounting_line_id:
                vals['line_ids'].append((1, line.accounting_line_id.id, line._synchronize_move_line_from_invoice_line()))
            else:
                vals['line_ids'].append((0, 0, line._synchronize_move_line_from_invoice_line()))
        for line in self.invoice_tax_line_ids:
            if line.accounting_line_id:
                vals['line_ids'].append((1, line.accounting_line_id.id, line._synchronize_move_line_from_invoice_tax()))
            else:
                vals['line_ids'].append((0, 0, line._synchronize_move_line_from_invoice_tax()))
        for line in self.invoice_pay_line_ids:
            if line.accounting_line_id:
                vals['line_ids'].append((1, line.accounting_line_id.id, line._synchronize_move_line_from_invoice_payment()))
            else:
                vals['line_ids'].append((0, 0, line._synchronize_move_line_from_invoice_payment()))
        return vals

    def _synchronize_invoice_from_move(self):
        self.ensure_one()
        return {
            'narration': self.narration,
            'accounting_date': self.date,
        }

    # -------------------------------------------------------------------------
    # DYNAMIC LINES
    # -------------------------------------------------------------------------

    def _recompute_tax_lines(self):
        ''' Compute the dynamic tax lines of the journal entry.

        :param lines_map: The line_ids dispatched by type containing:
            * base_lines: The lines having a tax_ids set.
            * tax_lines: The lines having a tax_line_id set.
            * terms_lines: The lines generated by the payment terms of the invoice.
            * rounding_lines: The cash rounding lines of the invoice.
        '''
        self.ensure_one()

        diff_taxes = self.invoice_line_ids._compute_diff_taxes(tax_lines=self.invoice_tax_line_ids)
        format_tax_vals = self.invoice_tax_line_ids._format_business_line_vals
        format_base_vals = self.invoice_line_ids._format_business_line_vals

        to_write = {
            'invoice_tax_line_ids': [],
            'invoice_line_ids': [],
        }

        # Create new tax lines from scratch.
        for tax_line_vals in diff_taxes.get('tax_line_to_add', []):
            to_write['invoice_tax_line_ids'].append((0, 0, format_tax_vals(tax_line_vals)))

        # Delete existing tax lines.
        for line in diff_taxes.get('tax_line_to_delete', []):
            to_write['invoice_tax_line_ids'].append((2, line.id))

        # Update existing tax lines.
        for line, tax_line_vals in diff_taxes.get('tax_line_to_update', []):
            to_write['invoice_tax_line_ids'].append((1, line.id, format_tax_vals(tax_line_vals)))

        # Update existing base lines.
        for line, base_line_vals in diff_taxes.get('base_line_to_update', []):
            to_write['invoice_line_ids'].append((1, line.id, format_base_vals(base_line_vals)))

        OrmUtils(self).write(to_write)

    def _recompute_cash_rounding_lines(self):
        ''' Handle the cash rounding feature on invoices.

        In some countries, the smallest coins do not exist. For example, in Switzerland, there is no coin for 0.01 CHF.
        For this reason, if invoices are paid in cash, you have to round their total amount to the smallest coin that
        exists in the currency. For the CHF, the smallest coin is 0.05 CHF.

        There are two strategies for the rounding:

        1) Add a line on the invoice for the rounding: The cash rounding line is added as a new invoice line.
        2) Add the rounding in the biggest tax amount: The cash rounding line is added as a new tax line on the tax
        having the biggest balance.
        '''
        self.ensure_one()
        to_write = {
            'invoice_line_ids': [],
            'invoice_tax_line_ids': [],
        }

        base_invoice_line_ids = self.invoice_line_ids.filtered(lambda line: not line.is_rounding_line)
        base_invoice_tax_line_ids = self.invoice_tax_line_ids.filtered(lambda line: not line.is_rounding_line)
        existing_cash_rounding_line = self.invoice_line_ids.filtered('is_rounding_line')
        existing_cash_rounding_tax_line = self.invoice_tax_line_ids.filtered('is_rounding_line')
        amount_untaxed = sum(base_invoice_line_ids.mapped('amount_untaxed'))
        amount_tax = sum(base_invoice_tax_line_ids.mapped('amount_tax'))

        if self.invoice_cash_rounding_id:
            difference = self.invoice_cash_rounding_id.compute_difference(self.currency_id, amount_untaxed + amount_tax)

            if not self.currency_id.is_zero(difference):
                if self.invoice_cash_rounding_id.strategy == 'biggest_tax':
                    biggest_tax_line = None
                    for tax_line in base_invoice_tax_line_ids:
                        if not biggest_tax_line or tax_line.amount_tax > biggest_tax_line.amount_tax:
                            biggest_tax_line = tax_line

                    if biggest_tax_line:
                        cash_rounding_tax_line_vals = {
                            **biggest_tax_line.copy_data()[0],
                            'name': _('%s (rounding)', biggest_tax_line.name),
                            'amount_tax': difference,
                            'is_rounding_line': True,
                        }

                        if existing_cash_rounding_tax_line:
                            to_write['invoice_tax_line_ids'].append((1, existing_cash_rounding_tax_line.id, cash_rounding_tax_line_vals))
                            existing_cash_rounding_tax_line = self.env['account.invoice.tax']
                        else:
                            to_write['invoice_tax_line_ids'].append((0, 0, cash_rounding_tax_line_vals))

                elif self.invoice_cash_rounding_id.strategy == 'add_invoice_line':
                    if difference > 0.0:
                        account = self.invoice_cash_rounding_id.loss_account_id
                    else:
                        account = self.invoice_cash_rounding_id.profit_account_id
                    cash_rounding_line_vals = {
                        'name': self.invoice_cash_rounding_id.name,
                        'account_id': account.id,
                        'quantity': 1.0,
                        'price_unit': difference,
                        'is_rounding_line': True,
                    }

                    if existing_cash_rounding_line:
                        to_write['invoice_line_ids'].append((1, existing_cash_rounding_line.id, cash_rounding_line_vals))
                        existing_cash_rounding_line = self.env['account.invoice.line']
                    else:
                        to_write['invoice_line_ids'].append((0, 0, cash_rounding_line_vals))

        if existing_cash_rounding_line:
            to_write['invoice_line_ids'].append((2, existing_cash_rounding_line.id))
        if existing_cash_rounding_tax_line:
            to_write['invoice_line_ids'].append((2, existing_cash_rounding_tax_line.id))

        OrmUtils(self).write(to_write)

    def _recompute_payment_terms_lines(self):
        ''' Compute the dynamic payment term lines of the journal entry.'''
        self.ensure_one()
        self = self.with_company(self.company_id or self.env.company)
        today = fields.Date.context_today(self)
        to_write = {'invoice_pay_line_ids': []}

        def _get_payment_terms_computation_date(self):
            ''' Get the date from invoice that will be used to compute the payment terms.
            :param self:    The current account.move record.
            :return:        A datetime.date object.
            '''
            if self.invoice_payment_term_id:
                return self.invoice_date or today
            else:
                return self.invoice_date_due or self.invoice_date or today

        amount_total = sum(self.invoice_line_ids.mapped('amount_untaxed')) + sum(self.invoice_tax_line_ids.mapped('amount_tax'))
        due_date = _get_payment_terms_computation_date(self)

        if self.invoice_payment_term_id:
            to_compute = self.invoice_payment_term_id.compute(amount_total, date_ref=due_date, currency=self.currency_id)
        else:
            to_compute = [(fields.Date.to_string(due_date), amount_total)]

        existing_pay_lines = list(self.invoice_pay_line_ids.sorted(lambda line: line.date_maturity or due_date))
        for date_maturity, amount_total in to_compute:

            vals = {
                'date_maturity': date_maturity,
                'amount_total': amount_total,
            }
            if existing_pay_lines:
                existing_pay_line = existing_pay_lines[0]
                existing_pay_lines = existing_pay_lines[1:]
                to_write['invoice_pay_line_ids'].append((1, existing_pay_line.id, vals))
            else:
                to_write['invoice_pay_line_ids'].append((0, 0, vals))

        for existing_pay_line in existing_pay_lines:
            to_write['invoice_pay_line_ids'].append((2, existing_pay_line.id))

        OrmUtils(self).write(to_write)

    def _recompute_dynamic_lines(self, snapshot0):
        base_line_changed = snapshot0.x2many_has_changed(
            'invoice_line_ids',
            names=self.invoice_line_ids._get_tax_tracked_fields(),
            filter=lambda vals: vals['tax_ids'])
        if base_line_changed:
            self._recompute_tax_lines()

        if snapshot0.any_has_changed(self._get_cash_rounding_tracked_fields()) \
            or snapshot0.x2many_has_changed('invoice_line_ids', names=self.invoice_line_ids._get_cash_rounding_tracked_fields()) \
            or snapshot0.x2many_has_changed('invoice_tax_line_ids', names=self.invoice_tax_line_ids._get_cash_rounding_tracked_fields()):
            self._recompute_cash_rounding_lines()

        if snapshot0.any_has_changed(self._get_payment_terms_tracked_fields()) \
            or snapshot0.x2many_has_changed('invoice_line_ids', names=self.invoice_line_ids._get_payment_terms_tracked_fields()) \
            or snapshot0.x2many_has_changed('invoice_tax_line_ids', names=self.invoice_tax_line_ids._get_payment_terms_tracked_fields()):
            self._recompute_payment_terms_lines()

    # -------------------------------------------------------------------------
    # LOW-LEVEL METHODS
    # -------------------------------------------------------------------------

    def _hook_pre_onchange(self, changed_fields):
        # OVERRIDE
        invoice_fields = list(set(self._get_cash_rounding_tracked_fields() + self._get_payment_terms_tracked_fields()))
        invoice_line_ids_fields = list(set(
            self.invoice_line_ids._get_tax_tracked_fields()
            + self.invoice_line_ids._get_cash_rounding_tracked_fields()
            + self.invoice_line_ids._get_payment_terms_tracked_fields()
        ))
        invoice_tax_line_ids_fields = list(set(
           self.invoice_tax_line_ids._get_cash_rounding_tracked_fields()
            + self.invoice_tax_line_ids._get_payment_terms_tracked_fields()
        ))
        snapshot0 = self.sudo()._create_snapshot(fields=invoice_fields + [
            'invoice_line_ids.%s' % field for field in invoice_line_ids_fields
        ] + [
            'invoice_tax_line_ids.%s' % field for field in invoice_tax_line_ids_fields
        ])
        snapshot0.force_has_changed([field for field in changed_fields if not self._fields[field].type == 'one2many'])

        if 'invoice_line_ids' in changed_fields:

            # Force changed fields inside the snapshot to determine which computation is
            # needed.
            removed_line = True
            for line in self.invoice_line_ids:
                if line.last_onchange_fields:
                    snapshot0.force_has_changed(['invoice_line_ids.%s' % field
                                                 for field in line.last_onchange_fields.split('-')])
                    line.last_onchange_fields = False
                    removed_line = False
            if removed_line:
                snapshot0.force_has_changed(['invoice_line_ids'])

        if 'invoice_tax_line_ids' in changed_fields:
            for line in self.invoice_tax_line_ids:
                if line.last_onchange_fields:
                    snapshot0.force_has_changed(['invoice_tax_line_ids.%s' % field
                                                 for field in line.last_onchange_fields.split('-')])
                    line.last_onchange_fields = False

        # Load an old vendor bill.
        if self.invoice_vendor_bill_id:
            # Copy invoice lines.
            for line in self.invoice_vendor_bill_id.invoice_line_ids:
                self.env['account.invoice.line'].new({
                    **line.copy_data()[0],
                    'invoice_id': self.id,
                })

            self.invoice_payment_term_id = self.invoice_vendor_bill_id.invoice_payment_term_id
            self.currency_id = self.invoice_vendor_bill_id.currency_id

            # Reset
            self.invoice_vendor_bill_id = False

        return snapshot0

    def _hook_post_onchange(self, snapshot0):
        # OVERRIDE
        self._recompute_dynamic_lines(snapshot0)

    @api.model_create_multi
    def create(self, vals_list):
        # OVERRIDE
        invoices = super().create(vals_list)

        for invoice in invoices.with_context(skip_account_move_synchronization=True, write_recursion=True):
            invoice.move_id.write(invoice._synchronize_move_from_invoice())
            for line in invoice.move_id.line_ids:
                if line.invoice_line_id:
                    line.invoice_line_id.accounting_line_id = line
                if line.invoice_tax_line_id:
                    line.invoice_tax_line_id.accounting_line_id = line
                if line.invoice_pay_line_id:
                    line.invoice_pay_line_id.accounting_line_id = line

        return invoices

    def write(self, vals):
        # OVERRIDE

        vals_list = []
        for invoice in self:
            vals_list.append(OrmUtils(invoice).cleanup_write_values(vals))

        # ===================================================================================================
        # Write: Writing is done in batch if possible.
        # ===================================================================================================

        if vals_list and all(vals == vals_list[0] for vals in vals_list):
            self_ctx = self.with_context(skip_account_move_synchronization=True)
            res = super(AccountInvoice, self_ctx).write(vals_list[0])
        else:
            res = True
            for invoice, vals in zip(self, vals_list):
                st_line_ctx = self.with_context(skip_account_move_synchronization=True)
                res |= super(AccountInvoice, st_line_ctx).write(vals)

        # ===================================================================================================
        # After write
        # ===================================================================================================

        if not self._context.get('write_recursion'):
            for invoice in self.with_context(skip_account_move_synchronization=True):
                invoice.move_id.write(invoice._synchronize_invoice_from_moves())

        return res

    # -------------------------------------------------------------------------
    # ACTIONS
    # -------------------------------------------------------------------------

    def action_invoice_post(self):
        return self.move_id.action_post()

    def action_invoice_sent(self):
        return self.move_id.action_invoice_sent()

    def action_register_payment(self):
        return self.move_id.action_register_payment()

    def action_invoice_portal_preview(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_url',
            'target': 'self',
            'url': self.get_portal_url(),
        }

    def action_invoice_cancel(self):
        return self.move_id.button_cancel()

    def action_invoice_draft(self):
        return self.move_id.button_draft()

    # -------------------------------------------------------------------------
    # BUSINESS CODE
    # -------------------------------------------------------------------------
