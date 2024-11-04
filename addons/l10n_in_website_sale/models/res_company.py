from odoo import models

# This field is used to map the response from gst api to corresponding selection field in odoo.
L10N_IN_GST_TREATMENT_MAPPING = {
    "SEZ Unit": "special_economic_zone",
    "Composition": "composition",
    "Consulate or Embassy of Foreign Country": "uin_holders"
}


class ResCompany(models.Model):
    _name = "res.company"
    _inherit = ['res.company']

    def _fetch_l10n_in_gst_treatment_and_fiscal_from_gstin(self, gstin):
        values = {}
        is_production = self.l10n_in_edi_production_env
        params = {
            'gstin_to_search': gstin
        }
        response = self.env['res.partner']._fetch_l10n_in_gstin_details(is_production, params)
        if response.get('error') and any(e.get('code') == 'no-credit' for e in response['error']):
            return False
        gst_treatment = L10N_IN_GST_TREATMENT_MAPPING.get(response.get('data', {}).get('dty'))
        fiscal_position = (
            gst_treatment == 'special_economic_zone'
            and self.env['account.chart.template'].ref('fiscal_position_in_export_sez_in', raise_if_not_found=False)
        )
        if gst_treatment:
            values['l10n_in_gst_treatment'] = gst_treatment
        if fiscal_position:
            values['property_account_position_id'] = fiscal_position.id
        elif gst_treatment and gst_treatment != 'special_economic_zone':
            values['property_account_position_id'] = False
        return values
