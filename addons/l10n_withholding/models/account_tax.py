# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class AccountTaxTemplate(models.Model):
    _inherit = 'account.tax.template'

    is_retention = fields.Boolean('Is retention tax', help="It will not be accounted for in the invoice itself, but "
                                                           "in a separate retention move")


class AccountTax(models.Model):
    _inherit = 'account.tax'

    is_retention = fields.Boolean('Is retention tax', help="It will not be accounted for in the invoice itself, but "
                                                           "in a separate retention move")

    def compute_all(self, price_unit, currency=None, quantity=1.0, product=None, partner=None, is_refund=False, handle_price_include=True):
        if not self.env.context.get('calc_retention'):
            taxes = self.filtered(lambda t: not t.is_retention)
            if any(t.is_retention for t in taxes):
                print("Filter retention")
        else:
            taxes = self
        return super(AccountTax, taxes).compute_all(price_unit, currency, quantity, product, partner, is_refund=is_refund, handle_price_include=handle_price_include)
