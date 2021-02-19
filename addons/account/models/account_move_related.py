from odoo import api, fields, models, _
from odoo import tools

class AccountMoveRelated(models.Model):
    # _inherit = "account.move"
    _name = "account.move.related"
    _auto = False

    name = fields.Char(
        string='Number',
        copy=False,
        compute='_compute_name',
        readonly=False,
        store=True,
        index=True,
        tracking=True,
    )
    highest_name = fields.Char(compute='_compute_highest_name')
    show_name_warning = fields.Boolean(store=False)
    date = fields.Date(
        string='Date',
        required=True,
        index=True,
        readonly=True,
        states={'draft': [('readonly', False)]},
        copy=False,
        default=fields.Date.context_today
    )
    ref = fields.Char(
        string='Reference',
        copy=False,
        tracking=True,
    )
    narration = fields.Text(string='Terms and Conditions')
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
    posted_before = fields.Boolean(
        help="Technical field for knowing if the move has been posted before",
        copy=False,
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
        store=True,
        index=True,
        readonly=True,
        tracking=True,
        default="entry",
        change_default=True,
    )
    type_name = fields.Char('Type Name', compute='_compute_type_name')
    to_check = fields.Boolean(
        string='To Check',
        default=False,
        tracking=True,
        help='If this checkbox is ticked, it means that the user was not sure of all the related information at the time of the creation of the move and that the move needs to be checked again.',
    )
    journal_id = fields.Many2one(
        'account.journal',
        string='Journal',
        required=True,
        readonly=True,
        states={'draft': [('readonly', False)]},
        check_company=True,
        domain="[('id', 'in', suitable_journal_ids)]",
        # default=_get_default_journal,
    )
    suitable_journal_ids = fields.Many2many(
        'account.journal',
        compute='_compute_suitable_journal_ids',
    )
    company_id = fields.Many2one(
        string='Company',
        store=True,
        readonly=True,
        related='journal_id.company_id',
        change_default=True,
        default=lambda self: self.env.company,
    )
    company_id_rel = fields.Many2one('res.company')  # ADDED FIELD
    company_currency_id = fields.Many2one(
        string='Company Currency',
        readonly=True,
        related='journal_id.company_id.currency_id',
    )
    currency_id = fields.Many2one(
        'res.currency',
        store=True,
        readonly=True,
        tracking=True, required=True,
        states={'draft': [('readonly', False)]},
        string='Currency',
        # default=_get_default_currency,
    )
    line_ids = fields.One2many(
        'account.move.line', 'move_id',
        string='Journal Items',
        copy=True,
        readonly=True,
        states={'draft': [('readonly', False)]},
    )
    partner_id = fields.Many2one(
        'res.partner',
        readonly=True,
        tracking=True,
        states={'draft': [('readonly', False)]},
        check_company=True,
        string='Partner',
        change_default=True,
    )
    commercial_partner_id = fields.Many2one(
        'res.partner',
        string='Commercial Entity',
        store=True,
        readonly=True,
        compute='_compute_commercial_partner_id',
    )
    country_code = fields.Char(
        related='company_id.country_id.code',
        readonly=True,
    )
    user_id = fields.Many2one(
        string='User', related='invoice_user_id',
        help='Technical field used to fit the generic behavior in mail templates.',
    )
    is_move_sent = fields.Boolean(
        readonly=True,
        default=False,
        copy=False,
        tracking=True,
        help="It indicates that the invoice/payment has been sent.",
    )
    partner_bank_id = fields.Many2one(
        'res.partner.bank',
        string='Recipient Bank',
        help='Bank Account Number to which the invoice will be paid. A Company bank account if this is a Customer Invoice or Vendor Credit Note, otherwise a Partner bank account number.',
        check_company=True,
    )
    payment_reference = fields.Char(
        string='Payment Reference',
        index=True,
        copy=False,
        help="The payment reference to set on journal items.",
    )
    payment_id = fields.Many2one(
        comodel_name='account.payment',
        string="Payment",
        copy=False,
        check_company=True,
    )
    statement_line_id = fields.Many2one(
        comodel_name='account.bank.statement.line',
        string="Statement Line",
        copy=False,
        check_company=True,
    )
    statement_id = fields.Many2one(
        related='statement_line_id.statement_id',
        copy=False,
        readonly=True,
        help="Technical field used to open the linked bank statement from the edit button in a group by view,"
             " or via the smart button on journal entries.",
    )

    # === Amount fields ===
    amount_untaxed = fields.Monetary(
        string='Untaxed Amount',
        store=True,
        readonly=True,
        tracking=True,
        compute='_compute_amount',
    )
    amount_tax = fields.Monetary(
        string='Tax',
        store=True,
        readonly=True,
        compute='_compute_amount',
    )
    amount_total = fields.Monetary(
        string='Total',
        store=True,
        readonly=True,
        compute='_compute_amount',
        inverse='_inverse_amount_total',
    )
    amount_residual = fields.Monetary(
        string='Amount Due',
        store=True,
        compute='_compute_amount',
    )
    amount_untaxed_signed = fields.Monetary(
        string='Untaxed Amount Signed',
        store=True,
        readonly=True,
        compute='_compute_amount',
        currency_field='company_currency_id',
    )
    amount_tax_signed = fields.Monetary(
        string='Tax Signed',
        store=True,
        readonly=True,
        compute='_compute_amount',
        currency_field='company_currency_id',
    )
    amount_total_signed = fields.Monetary(
        string='Total Signed',
        store=True,
        readonly=True,
        compute='_compute_amount',
        currency_field='company_currency_id',
    )
    amount_residual_signed = fields.Monetary(
        string='Amount Due Signed',
        store=True,
        compute='_compute_amount',
        currency_field='company_currency_id',
    )
    amount_by_group = fields.Binary(
        string="Tax amount by group",
        compute='_compute_invoice_taxes_by_group',
        help='Edit Tax amounts if you encounter rounding issues.',
    )
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
        store=True,
        readonly=True,
        copy=False,
        tracking=True,
        compute='_compute_amount',
    )

    # ==== Cash basis feature fields ====
    tax_cash_basis_rec_id = fields.Many2one(
        'account.partial.reconcile',
        string='Tax Cash Basis Entry of',
        help="Technical field used to keep track of the tax cash basis reconciliation. "
             "This is needed when cancelling the source: it will post the inverse journal entry to cancel that part too.",
    )
    tax_cash_basis_move_id = fields.Many2one(
        comodel_name='account.move',
        string="Origin Tax Cash Basis Entry",
        help="The journal entry from which this tax cash basis journal entry has been created.",
    )

    # ==== Auto-post feature fields ====
    auto_post = fields.Boolean(
        string='Post Automatically',
        default=False,
        copy=False,
        help='If this checkbox is ticked, this entry will be automatically posted at its date.',
    )

    # ==== Reverse feature fields ====
    reversed_entry_id = fields.Many2one(
        'account.move',
        string="Reversal of",
        readonly=True,
        copy=False,
        check_company=True,
    )
    reversal_move_id = fields.One2many(
        'account.move',
        'reversed_entry_id',
    )

    # =========================================================
    # Invoice related fields
    # =========================================================

    # ==== Business fields ====
    fiscal_position_id = fields.Many2one(
        'account.fiscal.position',
        string='Fiscal Position',
        readonly=True,
        states={'draft': [('readonly', False)]},
        check_company=True,
        domain="[('company_id', '=', company_id)]",
        ondelete="restrict",
        help="Fiscal positions are used to adapt taxes and accounts for particular customers or sales orders/invoices. "
             "The default value comes from the customer.",
    )
    invoice_user_id = fields.Many2one(
        'res.users',
        copy=False,
        tracking=True,
        string='Salesperson',
        default=lambda self: self.env.user,
    )
    invoice_date = fields.Date(
        string='Invoice/Bill Date',
        readonly=True,
        index=True,
        copy=False,
        states={'draft': [('readonly', False)]},
        # default=_get_default_invoice_date,
    )
    invoice_date_due = fields.Date(
        string='Due Date',
        readonly=True,
        index=True,
        copy=False,
        states={'draft': [('readonly', False)]},
    )
    invoice_origin = fields.Char(
        string='Origin',
        readonly=True,
        tracking=True,
        help="The document(s) that generated the invoice.",
    )
    invoice_payment_term_id = fields.Many2one(
        'account.payment.term',
        string='Payment Terms',
        check_company=True,
        readonly=True, states={'draft': [('readonly', False)]},
    )
    # /!\ invoice_line_ids is just a subset of line_ids.
    invoice_line_ids = fields.One2many(
        'account.move.line', 'move_id',
        string='Invoice lines',
        copy=False,
        readonly=True,
        domain=[('exclude_from_invoice_tab', '=', False)],
        states={'draft': [('readonly', False)]},
    )
    invoice_incoterm_id = fields.Many2one(
        'account.incoterms',
        string='Incoterm',
        # default=_get_default_invoice_incoterm,
        help='International Commercial Terms are a series of predefined commercial terms used in international transactions.',
    )
    display_qr_code = fields.Boolean(
        string="Display QR-code",
        related='company_id.qr_code',
    )
    qr_code_method = fields.Selection(
        string="Payment QR-code",
        selection=lambda self: self.env['res.partner.bank'].get_available_qr_methods_in_sequence(),
        help="Type of QR-code to be generated for the payment of this invoice, when printing it. If left blank, the first available and usable method will be used.",
    )

    # ==== Payment widget fields ====
    invoice_outstanding_credits_debits_widget = fields.Text(
        groups="account.group_account_invoice,account.group_account_readonly",
        compute='_compute_payments_widget_to_reconcile_info',
    )
    invoice_has_outstanding = fields.Boolean(
        groups="account.group_account_invoice,account.group_account_readonly",
        compute='_compute_payments_widget_to_reconcile_info',
    )
    invoice_payments_widget = fields.Text(
        groups="account.group_account_invoice,account.group_account_readonly",
        compute='_compute_payments_widget_reconciled_info',
    )

    # ==== Vendor bill fields ====
    invoice_vendor_bill_id = fields.Many2one(
        'account.move',
        store=False,
        check_company=True,
        string='Vendor Bill',
        help="Auto-complete from a past bill.",
    )
    invoice_source_email = fields.Char(
        string='Source Email',
        tracking=True,
    )
    invoice_partner_display_name = fields.Char(
        compute='_compute_invoice_partner_display_info',
        store=True,
    )

    # ==== Cash rounding fields ====
    invoice_cash_rounding_id = fields.Many2one(
        'account.cash.rounding',
        string='Cash Rounding Method',
        readonly=True,
        states={'draft': [('readonly', False)]},
        help='Defines the smallest coinage of the currency that can be used to pay by cash.',
    )

    # ==== Display purpose fields ====
    invoice_filter_type_domain = fields.Char(
        compute='_compute_invoice_filter_type_domain',
        help="Technical field used to have a dynamic domain on journal / taxes in the form view.",
    )
    bank_partner_id = fields.Many2one(
        'res.partner',
        help='Technical field to get the domain on the bank',
        compute='_compute_bank_partner_id',
    )
    invoice_has_matching_suspense_amount = fields.Boolean(
        compute='_compute_has_matching_suspense_amount',
        groups='account.group_account_invoice,account.group_account_readonly',
        help="Technical field used to display an alert on invoices if there is at least a matching amount in any supsense account.",
    )
    tax_lock_date_message = fields.Char(
        compute='_compute_tax_lock_date_message',
        help="Technical field used to display a message when the invoice's accounting date is prior of the tax lock date.",
    )
    display_inactive_currency_warning = fields.Boolean(
        compute="_compute_display_inactive_currency_warning",
        help="Technical field used for tracking the status of the currency",
    )
    # Technical field to hide Reconciled Entries stat button
    has_reconciled_entries = fields.Boolean(
        compute="_compute_has_reconciled_entries",
    )
    show_reset_to_draft_button = fields.Boolean(
        compute='_compute_show_reset_to_draft_button',
    )

    # ==== Hash Fields ====
    restrict_mode_hash_table = fields.Boolean(
        related='journal_id.restrict_mode_hash_table',
    )
    secure_sequence_number = fields.Integer(
        string="Inalteralbility No Gap Sequence #",
        readonly=True,
        copy=False,
    )
    inalterable_hash = fields.Char(
        string="Inalterability Hash",
        readonly=True,
        copy=False,
    )
    string_to_hash = fields.Char(
        compute='_compute_string_to_hash',
        readonly=True,
    )

    def _compute_name(self):
        pass

    def _compute_highest_name(self):
        pass

    def _compute_type_name(self):
        pass

    def _compute_suitable_journal_ids(self):
        pass

    def _compute_commercial_partner_id(self):
        pass

    def _compute_invoice_taxes_by_group(self):
        pass

    def _compute_amount(self):
        pass

    def _compute_payments_widget_to_reconcile_info(self):
        pass

    def _compute_payments_widget_reconciled_info(self):
        pass

    def _compute_invoice_partner_display_info(self):
        pass

    def _compute_invoice_filter_type_domain(self):
        pass

    def _compute_bank_partner_id(self):
        pass

    def _compute_has_matching_suspense_amount(self):
        pass

    def _compute_tax_lock_date_message(self):
        pass

    def _compute_display_inactive_currency_warning(self):
        pass

    def _compute_has_reconciled_entries(self):
        pass

    def _compute_show_reset_to_draft_button(self):
        pass

    def _compute_string_to_hash(self):
        pass

    company_id_rel = fields.Many2one('res.company')  # ADDED FIELD

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute('''
            CREATE OR REPLACE VIEW %s AS (
                SELECT move.*,
                       journal.restrict_mode_hash_table AS restrict_mode_hash_table,
                       journal.company_id               AS company_id_rel,
                       company.currency_id              AS company_currency_id,
                       country.code                     AS country_code,
                       statement_line.statement_id      AS statement_id,
                       company.qr_code                  AS qr_code
                FROM account_move move
                LEFT JOIN account_journal journal ON journal.id = move.journal_id
                LEFT JOIN res_company company ON company.id = journal.company_id
                LEFT JOIN res_partner company_partner ON company_partner.id = company.partner_id
                LEFT JOIN res_country country ON country.id = company_partner.country_id
                LEFT JOIN account_bank_statement_line statement_line ON statement_line.id = move.statement_line_id
            )
        ''' % (
            self._table,
        ))
