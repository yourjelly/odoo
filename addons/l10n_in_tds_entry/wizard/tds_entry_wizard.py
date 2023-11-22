# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, models, fields, api, Command
from odoo.exceptions import UserError, RedirectWarning


class TdsEntryWizard(models.TransientModel):
    _name = 'tds.entry.wizard'
    _description = "Create Tds Entry Wizard"

    @api.model
    def default_get(self, fields_list):
        defaults = super().default_get(fields_list)
        if self.env.context.get('active_model') != 'account.move':
            raise UserError(_("You can only create TDS entry from journal entrie."))
        move_id = self.env.context['active_id']
        defaults['move_id'] = move_id
        move = self.env['account.move'].browse(self.env.context['active_id'])
        if not self.env['account.tax'].search([('company_id', '=', move.company_id.id), ('tax_group_id', 'ilike', 'TDS')], limit=1):
            raise RedirectWarning(_("Active Approprite TDS Taxes"), self.env.ref('account.action_tax_form').id, _('Go to the taxs.'))
        return defaults

    move_id = fields.Many2one('account.move', required=True)
    date = fields.Date(string="Entry Date", compute='_compute_on_move', store=True, readonly=False, required=True)
    ref = fields.Char(string="Reference", compute='_compute_on_move', store=True, readonly=False, required=True)
    amount_untaxed = fields.Monetary(string="Base Amount", currency_field='currency_id', compute='_compute_on_move', store=True, readonly=False)
    currency_id = fields.Many2one(related="move_id.currency_id", string="Currency")
    commercial_partner_id = fields.Many2one(related="move_id.commercial_partner_id", string="Partner")
    company_id = fields.Many2one(related="move_id.company_id", string="Company")
    l10n_in_pan = fields.Char(related="move_id.commercial_partner_id.l10n_in_pan", string="PAN")
    company_type = fields.Selection(related="move_id.commercial_partner_id.company_type")
    tax_id = fields.Many2one('account.tax', string="TDS Tax", required=True)
    tds_amount = fields.Monetary(string="TDS Amount", compute='_compute_tds_amount', currency_field='currency_id')
    journal_id = fields.Many2one(
        comodel_name='account.journal',
        string='Journal',
        required=True,
        domain=[('type', '=', 'general')],
        default=lambda self: self.env['account.journal'].search([('type', '=', 'general')], limit=1)
    )


    @api.depends('move_id')
    def _compute_on_move(self):
        for rec in self:
            rec.amount_untaxed = rec.move_id.amount_untaxed
            rec.date = rec.move_id.date
            rec.ref = _("TDS of %s", rec.move_id.name)

    @api.depends('amount_untaxed', 'tax_id')
    def _compute_tds_amount(self):
        for rec in self:
            taxes_compute_all = rec.tax_id.compute_all(price_unit=rec.amount_untaxed, currency=self.currency_id, handle_price_include=False)
            rec.tds_amount = sum(tax['amount'] for tax in taxes_compute_all['taxes']) * -1

    def _convert_to_tax_base_line_dict(self, price_unit):
        self.ensure_one()
        return self.env['account.tax']._convert_to_tax_base_line_dict(
            base_line=None,
            currency=self.currency_id,
            taxes=self.tax_id,
            price_unit=price_unit,
            quantity=1,
            handle_price_include=False,
        )

    def create_tds_entry(self):
        if self.amount_untaxed <= 0:
            raise UserError(_("Base amount should be greater than 0."))
        move_lines = []
        tax_data = self.env['account.tax']._compute_taxes([
            self._convert_to_tax_base_line_dict(price_unit=self.amount_untaxed)
        ])
        tax_total = tax_total_balance = 0.00
        rate = self.currency_id._get_conversion_rate(self.currency_id, self.move_id.company_currency_id, self.date)
        for tax_line_data in tax_data['tax_lines_to_add']:  # Add tax lines
            tax_amount = tax_line_data['tax_amount']
            tax_line_balance = self.move_id.company_currency_id.round(tax_amount / rate)
            tax_total += tax_amount
            tax_total_balance += tax_line_balance
            tax_line = {
                'name': self.tax_id.name,
                'account_id': tax_line_data['account_id'],
                'tax_tag_ids': tax_line_data['tax_tag_ids'],
                'balance': tax_line_balance,
                'amount_currency': tax_amount,
                'tax_base_amount': self.move_id.company_currency_id.round(self.amount_untaxed / rate),
                'currency_id': self.currency_id.id,
                'partner_id': self.commercial_partner_id.id,
            }
            move_lines.append(tax_line)
        move_lines.append({
            'name': f'TDS Deduction on {self.amount_untaxed} {self.currency_id.name}',
            'account_id': self.commercial_partner_id.property_account_payable_id.id,
            'amount_currency': -tax_total,
            'balance': -tax_total_balance,
            'currency_id': self.currency_id.id,
            'partner_id': self.commercial_partner_id.id,
        })
        move_id = self.env['account.move'].create({
            'move_type': 'entry',
            'ref': self.ref,
            'date': self.date,
            'journal_id': self.journal_id.id,
            'partner_id': self.commercial_partner_id.id,
            'l10n_in_is_tds': True,
            'line_ids': [Command.create(line) for line in move_lines],
        })
        move_id.action_post()
        creditors_line = self.move_id.line_ids.filtered(lambda line: line.account_id.internal_group == 'liability')
        move_id.js_assign_outstanding_line(creditors_line.id)
