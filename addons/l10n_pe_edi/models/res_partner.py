from odoo import fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    ubl_cii_format = fields.Selection(selection_add=[('ubl_pe', 'PE UBL 2.1')])

    def _compute_ubl_cii_format(self):
        for partner in self:
            if partner.country_code == 'PE':
                partner.ubl_cii_format = 'ubl_pe'
        return super()._compute_ubl_cii_format()

    def _get_edi_builder(self):
        if self.ubl_cii_format == 'ubl_pe':
            return self.env['account.edi.xml.ubl_pe']
        return super()._get_edi_builder()
