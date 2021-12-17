# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class SaleOrderTemplateOption(models.Model):
    _name = "sale.order.template.option"
    _description = "Quotation Template Option"
    _check_company_auto = True

    sale_order_template_id = fields.Many2one('sale.order.template', 'Quotation Template Reference', ondelete='cascade',
        index=True, required=True)
    company_id = fields.Many2one('res.company', related='sale_order_template_id.company_id', store=True, index=True)
    name = fields.Text('Description', required=True, translate=True)
    product_id = fields.Many2one(
        'product.product', 'Product', domain=[('sale_ok', '=', True)],
        required=True, check_company=True)
    uom_id = fields.Many2one('uom.uom', 'Unit of Measure ', required=True, domain="[('category_id', '=', product_uom_category_id)]")
    product_uom_category_id = fields.Many2one(related='product_id.uom_id.category_id', readonly=True)
    quantity = fields.Float('Quantity', required=True, digits='Product Unit of Measure', default=1)

    @api.onchange('product_id')
    def _onchange_product_id(self):
        if not self.product_id:
            return
        self.uom_id = self.product_id.uom_id
        self.name = self.product_id.get_product_multiline_description_sale()
