# -*- coding: utf-8 -*-

from odoo import api, fields, models, _, tools

class AccountTax(models.Model):
    _inherit = 'account.tax'

    analytic = fields.Boolean(string="Include in Analytic Cost", help="If set, the amount computed by this tax will be assigned to the same analytic account as the invoice line (if any)")

    def compute_all(self, price_unit, currency=None, quantity=1.0, product=None, partner=None, is_refund=False, handle_price_include=True, flattened_taxes=None):
        # override compute_all in order to add "analytic" value to taxes in returned data
        flattened_taxes = flattened_taxes or self.flatten_taxes_hierarchy()
        tax_id_analytic = {}
        for tax in flattened_taxes:
            tax_id_analytic[tax.id] = tax.analytic
        computed = super(AccountTax, self).compute_all(price_unit, currency, quantity, product, partner, is_refund, handle_price_include, flattened_taxes)
        for tax in computed['taxes']:
            tax['analytic'] = tax_id_analytic[tax['id']]
        return computed
