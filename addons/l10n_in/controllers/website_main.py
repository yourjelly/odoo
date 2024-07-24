from odoo.addons.website_sale.controllers.main import WebsiteSale


class WebsiteSaleInherit(WebsiteSale):
    def _update_user_sez_status(self, partner, vat, l10n_in_sez_status):
        partner.sudo()._update_user_sez_status(vat, l10n_in_sez_status)
        return super()._update_user_sez_status(partner, vat, l10n_in_sez_status)
