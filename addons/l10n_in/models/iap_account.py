# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models
from odoo.addons.l10n_in import const
from odoo.addons.iap import jsonrpc


class IapAccount(models.Model):
    _inherit = 'iap.account'

    @api.model
    def _l10n_in_connect_to_server(self, is_production, params, url_path, config_parameter, timeout=25):
        user_token = self.get(const.IAP_SERVICE_NAME)
        params.update({
            "dbuuid": self.env["ir.config_parameter"].sudo().get_param("database.uuid"),
            "account_token": user_token.account_token,
        })
        if is_production:
            default_endpoint = const.DEFAULT_IAP_ENDPOINT
        else:
            default_endpoint = const.DEFAULT_IAP_TEST_ENDPOINT
        endpoint = self.env["ir.config_parameter"].sudo().get_param(config_parameter, default_endpoint)
        url = "%s%s" % (endpoint, url_path)
        return jsonrpc(url, params=params, timeout=timeout)
