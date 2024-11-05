from odoo import models


class AccountTax(models.Model):
    _inherit = 'account.tax'

    def _l10n_jo_is_exempt_tax(self):
        self.ensure_one()
        exempted_taxes_refs = ['jo_zero_sale_exempted']
        return self.id in [self.env['account.chart.template'].ref(tax_ref).id for tax_ref in exempted_taxes_refs]
