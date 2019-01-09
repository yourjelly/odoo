# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class SaleOrder(models.Model):
    _inherit = "sale.order"

    ddt_ids = fields.Many2many('l10n.it.ddt')
    auto_ddt = fields.Boolean()
    ddt_count = fields.Integer(
        string='DDT Count',
        compute='_get_ddt_count', readonly=True)

    def _get_ddt_count(self):
        for order in self:
            order.ddt_count = len(self.mapped('ddt_ids'))

    @api.multi
    def _pripare_ddt(self):
        self.ensure_one()
        line_vals = []
        for line in self.order_line:
            line_vals.append([0, 0, {
                'product_id': line.product_id.id,
                'quantity': line.product_uom_qty,
                'product_uom_id': line.product_uom.id,
                'unit_price': line.price_unit,
                'discount': line.discount,
                'name': line.name
                }])

        res = {
            'partner_id': self.partner_id.id,
            'partner_shipping_id': self.partner_shipping_id.id,
            'partner_invoice_id': self.partner_invoice_id.id,
            'company_id': self.company_id.id,
            'ddt_line_id': line_vals
            }
        print(res)
        return res

    @api.multi
    def action_confirm(self):
        res = super(SaleOrder, self).action_confirm()
        for sale_order in self:
            if sale_order.auto_ddt:
                sale_order.ddt_ids = self.env['l10n.it.ddt'].create(sale_order._pripare_ddt())
        return res

    @api.multi
    def action_view_ddt(self):
        ddt = self.mapped('ddt_ids')
        form_view_id = self.env.ref('l10n_it_ddt.l10n_it_ddt_form').id
        tree_view_id = self.env.ref('l10n_it_ddt.l10n_it_ddt_tree').id
        result = {
                    "name": "DDT",
                    "type": "ir.actions.act_window",
                    "res_model": "l10n.it.ddt"
                }
        if len(ddt) == 1:
            result.update({
                "views": [[form_view_id, "form"]],
                "res_id": ddt.ids[0],
                })
        else:
            result.update({
                    "views": [[tree_view_id, "tree"]],
                    "domain": [('id', 'in', ddt.ids)]
                })
        return result
