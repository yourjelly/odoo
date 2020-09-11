# -*- coding: utf-8 -*-
from odoo import api, fields, models, _


class AccountBusinessLineMixin(models.AbstractModel):
    _inherit = 'account.business.line.mixin'

    def _get_tax_grouping_key_from_base_lines(self, tax_vals):
        # OVERRIDE
        # Group taxes by products.
        vals = super()._get_tax_grouping_key_from_base_lines(tax_vals)
        company = self._get_company()
        if company.country_id.code == 'IN':
            vals['product_id'] = self._get_product().id
        return vals

    def _get_tax_grouping_key_from_tax_line(self):
        # OVERRIDE
        # Group taxes by products.
        vals = super()._get_tax_grouping_key_from_tax_line()
        company = self._get_company()
        if company.country_id.code == 'IN':
            vals['product_id'] = self._get_product().id
        return vals
