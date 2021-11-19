# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class AdyenAccount(models.Model):
    _inherit = 'adyen.account'

    def unlink(self):
        # Disable odoo acquirers since linked account is deleted
        acquirer = self.env['payment.acquirer'].search([
            ('provider', '=', 'odoo'),
            ('company_id.adyen_account_id', 'in', self.ids)])
        acquirer.state = 'disabled'
        return super().unlink()
