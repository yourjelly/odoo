# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
from odoo import fields, models, _
from odoo.addons.iap import jsonrpc
from odoo.exceptions import UserError, AccessError

_logger = logging.getLogger(__name__)


class ResPartner(models.Model):
    _inherit = 'res.partner'

    l10n_in_gstin_verified_status = fields.Char(string="GSTIN Verified Status")
    l10n_in_gstin_verified_date = fields.Date(string="GSTIN Verified Date")

    def get_verified_status(self):
        if not self.vat:
            raise UserError(_('Enter GSTIN before checking the status.'))
        url = "https://jva-odoo-iap-apps2-15-0-gst-number-active-check-jva-13181640.dev.odoo.com/iap/l10n_in_reports/1/public/search"
        user_token = self.env["iap.account"].get("l10n_in_edi")
        uuid = self.env["ir.config_parameter"].sudo().get_param("database.uuid")
        for partner in self:
            params = {"account_token": user_token.account_token, "dbuuid": uuid, "gstin_to_search": partner.vat}
            try:
                response = jsonrpc(url, params=params, timeout=25)
                if response.get("error"):
                    error = response["error"]
                    error_codes = [e.get("code") for e in error]
                    if "SWEB_9035" in error_codes:
                        raise UserError(_("Invalid GSTIN / UID"))
                    if "GEN5008" in error_codes:
                        raise UserError(_("API is currently under maintenance. Please try again later."))
                    if "FO8000" in error_codes:
                        raise UserError(_("No records found for the provided GSTIN."))
                    _logger.error("Unexpected error: %s", str(error))
                    raise UserError(_("Error: %s", str(error)))
            except AccessError as e:
                raise UserError(_("Error: %s", str(e)))
            verified_status = response.get('data', {}).get('sts', "")
            if verified_status:
                partner.l10n_in_gstin_verified_status = verified_status
                partner.l10n_in_gstin_verified_date = fields.Date.today()
