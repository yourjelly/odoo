from odoo import fields, models, _


class ResCompany(models.Model):

    def _set_dua_product_taxes(self):


    def _load(self, template_code, company, install_demo):
        # EXTENDS account to create journals and setup withhold taxes in company configuration
        res = super()._load(template_code, company, install_demo)
        if template_code.startswith('es'):
            self._load_
