from odoo.addons.account.controllers.portal import CustomerPortal
from odoo.http import request


class CustomerPortalInherit(CustomerPortal):

    def _get_optional_fields(self):
        optional_fields = super()._get_optional_fields()
        optional_fields += ['l10n_in_gst_treatment', 'property_account_position_id']
        return optional_fields

    def details_form_validate(self, data, partner_creation=False):
        error, error_message = super().details_form_validate(data, partner_creation)
        if country_id := request.params.get('country_id'):
            country = request.env['res.country'].search([('id', '=', country_id)], limit=1)
        else:
            country = request.env['res.country'].browse()
        if (
            request.env.company.account_fiscal_country_id.code == "IN"
            and country.code == "IN"
            and (gstin := data.get('vat'))
            and (values := request.env.company.sudo()._fetch_l10n_in_gst_treatment_and_fiscal_from_gstin(gstin))
        ):
            data.update(values)
        return error, error_message
