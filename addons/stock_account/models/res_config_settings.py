# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    module_stock_landed_costs = fields.Boolean("Landed Costs",
        help="Affect landed costs on reception operations and split them among products to update their cost price.")
    group_lot_on_invoice = fields.Boolean("Display Lots & Serial Numbers on Invoices",
                                          implied_group='stock_account.group_lot_on_invoice')
    # group_stock_accounting_automatic = fields.Boolean(
    #     "Automatic Stock Accounting", implied_group="stock_account.group_stock_accounting_automatic")
    automatic_accounting = fields.Boolean(related="company_id.automatic_accounting", string="Automatic Accounting", readonly=False)

    def set_values(self):
        super().set_values()
        print("===================================",self.automatic_accounting,"=======================")
        if self.automatic_accounting:
            self.env['product.category'].sudo().with_context(active_test=False).search([]).property_valuation = 'real_time'
        else:
            self.env['product.category'].sudo().with_context(active_test=False).search([
                ('property_valuation', '=', 'real_time')]).property_valuation = 'manual_periodic'

        # super().set_values()
        # # self.env['ir.config_parameter'].sudo().set_param('stock_account.group_stock_accounting_automatic', self.group_stock_accounting_automatic)

        # self.group_stock_accounting_automatic = self.automatic_accounting
        # if self.group_stock_accounting_automatic:
        #     self.env['product.category'].sudo().with_context(active_test=False).search([]).property_valuation = 'real_time'
        # else:
        #     self.env['product.category'].sudo().with_context(active_test=False).search([
        #         ('property_valuation', '=', 'real_time')]).property_valuation = 'manual_periodic'

    # @api.model
    # def get_values(self):
    #     res = super(ResConfigSettings, self).get_values()
    #     res.update(
    #         automatic_accounting=self.env['ir.config_parameter'].sudo().get_param('stock_account.group_stock_accounting_automatic', default=False),
    #     )
    #     return res
