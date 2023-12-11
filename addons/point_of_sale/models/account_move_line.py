# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models
from odoo.tools import ormcache

class AccountMoveLine(models.Model):
    _inherit = 'account.move.line'

    @api.depends('account_id.account_type', 'company_id')
    def _compute_blocked(self):
        super()._compute_blocked()
        for line in self:
            # accout move lines from general journals are excluded by default from the followup (blocked)
            # The default PoS journal is such a journal, but may contain lines we want to follow up on:
            # The payment term lines created for the Customer Account / 'pay_later' payment method.
            if line.blocked and line.account_id.account_type in ['asset_receivable', 'liability_payable']:
                pos_journals = self._get_pos_journals(line.company_id)
                line.blocked = line.journal_id not in pos_journals

    @api.model
    @ormcache('company')
    def _get_pos_journals(self, company):
        return self.env['pos.config'].search([
            *self._check_company_domain(company),
        ]).journal_id
