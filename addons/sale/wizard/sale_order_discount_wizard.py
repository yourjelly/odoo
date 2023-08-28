# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict

from odoo import Command, fields, models, _


class SaleOrderDiscountWizard(models.TransientModel):
    _name = 'sale.order.discount.wizard'
    _description = 'Disount Wizard'

    sale_order_id = fields.Many2one('sale.order', string="Sale Order", default=lambda self: self.env.context.get('active_id'), required=True)
    discount_amount = fields.Float("Discount Amount")
    discount_type = fields.Selection([
        ("on_all_order_lines", "On All Order Lines (%)"),
        ("global_discount", "Global Discount (%)"),
        ("fixed_amount", "Fixed Amount")
    ], string="Discount", default="on_all_order_lines")

    def create_order_lines_for_discount(self):
        discount_product_id = self.env.ref('product.product_product_consumable').id
        total_price_per_tax = defaultdict(float)
        for line in self.sale_order_id.order_line:
            if not (line.product_uom_qty and line.price_unit):
                continue
            total_price_per_tax[line.tax_id] += line.price_unit * line.product_uom_qty
        if self.discount_type == 'fixed_amount':
            self.env['sale.order.line'].create({
                'order_id': self.sale_order_id.id,
                'product_id': discount_product_id,
                'name': _(
                    'Discount: %(desc)s',
                    desc=self.discount_amount,
                ),
                'price_unit': -self.discount_amount,
                'sequence': 999,
                'tax_id': False,
            })
        else:
            self.env['sale.order.line'].create([{
                'order_id': self.sale_order_id.id,
                'product_id': discount_product_id,
                'name':_(
                    'Discount: %(desc)s%% %(tax_str)s',
                    desc=self.discount_amount,
                    tax_str=_('- On product with the following taxes: ') + tax.name if tax else '',
                ),
                'price_unit': - price_subtotal * self.discount_amount / 100,
                'sequence': 999,
                'tax_id': [(Command.CLEAR, 0, 0)] + [(Command.LINK, tax.id, False)] if tax else [],
            } for tax, price_subtotal in total_price_per_tax.items()])

    def action_apply(self):
        if self.discount_type == 'on_all_order_lines':
            self.sale_order_id.mapped('order_line').write({'discount': self.discount_amount})
        else:
            self.create_order_lines_for_discount()
