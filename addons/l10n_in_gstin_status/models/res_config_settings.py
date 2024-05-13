# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, models
from odoo.exceptions import UserError
from odoo.addons.l10n_in.const import IAP_SERVICE_NAME


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    def l10n_in_edi_buy_iap(self):
        if not self.l10n_in_edi_production_env:
            raise UserError(_("You must enable production environment to buy credits"))
        return {
            'type': 'ir.actions.act_url',
            'url': self.env["iap.account"].get_credits_url(service_name=IAP_SERVICE_NAME),
            'target': '_new'
        }
