from odoo.addons.website_sale.controllers.main import WebsiteSale
from odoo.http import request


class WebsiteSaleInherit(WebsiteSale):

    def _parse_form_data(self, form_data):
        address_values, extra_form_data = super()._parse_form_data(form_data)
        if country_id := request.params.get('country_id'):
            country = request.env['res.country'].search([('id', '=', country_id)], limit=1)
        else:
            country = request.env['res.country'].browse()
        if (
            request.env.company.account_fiscal_country_id.code == "IN"
            and country.code == "IN"
            and (gstin := request.params.get('vat'))
            and (values := request.env.company.sudo()._fetch_l10n_in_gst_treatment_and_fiscal_from_gstin(gstin))
        ):
            address_values.update(values)
        return address_values, extra_form_data
