from odoo import models


class AccountMove(models.Model):
    _inherit = 'account.move'

    @api.constrains('line_ids', 'fiscal_position_id', 'company_id')
    def _validate_taxes_country(self):
        return True
