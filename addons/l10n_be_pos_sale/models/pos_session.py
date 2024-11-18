from odoo import models


class PosSession(models.Model):
    _inherit = 'pos.session'

    def _pos_data_process(self, loaded_data):
        res = super()._pos_data_process(loaded_data)
        if self.company_id.country_code == 'BE':
            intracom_fpos = self.env.ref("l10n_be.fiscal_position_template_3", False).with_company(self.company_id)
            loaded_data['intracom_tax_ids'] = intracom_fpos.tax_ids.tax_dest_id.ids
        return res
