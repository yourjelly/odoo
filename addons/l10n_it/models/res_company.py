# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class ResCompany(models.Model):
    _name = 'res.company'
    _inherit = 'res.company'

    @api.model
    def _l10n_it_get_declaration_of_intent_fiscal_position(self):
        """
        Return the fiscal position to be used for an Invoice or Sales Order using a Declaration of Intent.
        """
        self.ensure_one()
        fiscal_position = self.env['account.chart.template'].with_company(self)\
            .ref('declaration_of_intent_fiscal_position', raise_if_not_found=False)
        return fiscal_position or self.env['account.fiscal.position']
