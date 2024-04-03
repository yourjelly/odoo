# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    l10n_it_use_declaration_of_intent = fields.Boolean(
        string="Use Declaration of Intent",
        compute='_compute_l10n_it_use_declaration_of_intent',
    )

    l10n_it_declaration_of_intent_id = fields.Many2one(
        string="Declaration of Intent",
        compute='_compute_l10n_it_declaration_of_intent_id',
        store=True, readonly=False, precompute=True,
        comodel_name='l10n_it.declaration_of_intent',
    )

    l10n_it_intent_threshold_warning = fields.Text(
        string="Declaration of Intent Threshold Warning",
        compute='_compute_l10n_it_intent_threshold_warning',
    )

    def _prepare_invoice(self):
        """
        Prepare the dict of values to create the new invoice for a sales order. This method may be
        overridden to implement custom invoice generation (making sure to call super() to establish
        a clean extension chain).
        """
        invoice_vals = super()._prepare_invoice()
        if self.country_code == 'IT':
            invoice_vals['l10n_it_declaration_of_intent_id'] = self.l10n_it_declaration_of_intent_id.id
        return invoice_vals

    @api.constrains('l10n_it_declaration_of_intent_id')
    def _check_l10n_it_declaration_of_intent_id(self):
        for record in self:
            declaration = record.l10n_it_declaration_of_intent_id
            if not declaration:
                return
            partner = record.partner_id.commercial_partner_id
            date = record.commitment_date or fields.Date.context_today(self)
            declaration._check_valid(record.company_id, partner, date, record.currency_id)

    def action_open_declaration_of_intent(self):
        self.ensure_one()
        return {
            'name': _("Declaration of Intent for %s", self.display_name),
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'l10n_it.declaration_of_intent',
            'res_id': self.l10n_it_declaration_of_intent_id.id,
        }

    @api.depends('l10n_it_declaration_of_intent_id', 'partner_id.commercial_partner_id')
    def _compute_l10n_it_use_declaration_of_intent(self):
        for order in self:
            order.l10n_it_use_declaration_of_intent = order.l10n_it_declaration_of_intent_id \
                or order.partner_id.commercial_partner_id.l10n_it_use_declaration_of_intent

    @api.depends('company_id', 'partner_id.commercial_partner_id', 'commitment_date', 'currency_id')
    def _compute_l10n_it_declaration_of_intent_id(self):
        for order in self:
            if not order.l10n_it_use_declaration_of_intent:
                order.l10n_it_declaration_of_intent_id = False
                continue

            partner = order.partner_id.commercial_partner_id
            date = order.commitment_date or fields.Date.context_today(self)
            currency = order.currency_id
            company = order.company_id

            # Avoid a query or changing a manually set declaration of intent
            # (if the declaration is still valid).
            current_declaration = order.l10n_it_declaration_of_intent_id
            if current_declaration and current_declaration._is_valid(company, partner, date, currency):
                continue

            declaration = self.env['l10n_it.declaration_of_intent']\
                ._fetch_valid_declaration_of_intent(company, partner, date, currency)
            if declaration:
                order.l10n_it_declaration_of_intent_id = declaration

    @api.depends('l10n_it_declaration_of_intent_id', 'l10n_it_declaration_of_intent_id.remaining_amount', 'state', 'amount_to_invoice')
    def _compute_l10n_it_intent_threshold_warning(self):
        for order in self:
            order.l10n_it_intent_threshold_warning = ''
            declaration = order.l10n_it_declaration_of_intent_id
            show_warning = declaration and order.state != 'cancelled'
            if not show_warning:
                continue
            updated_remaining = declaration.remaining_amount - order.amount_to_invoice
            order.l10n_it_intent_threshold_warning = declaration._build_threshold_warning_message(order, updated_remaining)

    @api.depends('l10n_it_declaration_of_intent_id')
    def _compute_fiscal_position_id(self):
        super()._compute_fiscal_position_id()
        for order in self:
            if order.l10n_it_declaration_of_intent_id:
                declaration_fiscal_position = order.company_id._l10n_it_get_declaration_of_intent_fiscal_position()
                if declaration_fiscal_position:
                    order.fiscal_position_id = declaration_fiscal_position
