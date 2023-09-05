# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict

from odoo import _, Command, fields, models


class SaleOrderDiscountWizard(models.TransientModel):
    _name = 'sale.order.discount.wizard'
    _description = 'Disount Wizard'

    sale_order_id = fields.Many2one(
        'sale.order', default=lambda self: self.env.context.get('active_id'), required=True)
    discount_amount = fields.Float()
    discount_type = fields.Selection(
        selection=[
            ('on_all_order_lines', "On All Order Lines (%)"),
            ('global_discount', "Global Discount (%)"),
            ('fixed_amount', "Fixed Amount")
        ],
        default='on_all_order_lines')

    def create_order_lines_for_discount(self):
        discount_product_id = self.env.ref('product.product_product_consumable').id
        total_price_per_tax = defaultdict(float)
        for line in self.sale_order_id.order_line:
            if not (line.product_uom_qty and line.price_unit):
                continue
            total_price_per_tax[line.tax_id] += line.price_unit * line.product_uom_qty
        mapped_taxes = {tax: self.sale_order_id.fiscal_position_id.map_tax(tax) for tax in total_price_per_tax}
        vals = {
            'order_id': self.sale_order_id.id,
            'product_id': discount_product_id,
            'sequence': 999,
        }
        if self.discount_type == 'fixed_amount':
            vals_list = [{
                **vals,
                'name': _("Discount: %(discount)s", discount=self.discount_amount),
                'price_unit': -self.discount_amount,
                'tax_id': False,
            }]
        else:
            vals_list = [{
                **vals,
                'name': _(
                    "Discount: %(percent)s%% %(tax_str)s",
                    percent=self.discount_amount,
                    tax_str=len(total_price_per_tax) and any(t.name for t in mapped_taxes[tax]) and _(" - On products with the following taxes: %(taxes)s", taxes=", ".join(mapped_taxes[tax].mapped('name'))) or "",
                ),
                'price_unit': - price_subtotal * self.discount_amount / 100,
                'tax_id': [(Command.CLEAR, 0, 0)] + [(Command.LINK, tax.id, False) for tax in mapped_taxes[tax]],
            } for tax, price_subtotal in total_price_per_tax.items()]
        self.env['sale.order.line'].create(vals_list)

    def action_apply(self):
        if self.discount_type == 'on_all_order_lines':
            self.sale_order_id.mapped('order_line').write({'discount': self.discount_amount})
        else:
            self.create_order_lines_for_discount()
