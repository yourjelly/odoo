# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ProductAttributeCustomValue(models.Model):
    _inherit = 'product.attribute.custom.value'

    sale_order_line_id = fields.Many2one(
        string="Sales Order Line", comodel_name='sale.order.line', ondelete='cascade',
    )

    _sql_constraints = [
        (
            'sol_custom_value_unique',
            'unique(custom_product_template_attribute_value_id, sale_order_line_id)',
            "Only one Custom Value is allowed per Attribute Value per Sales Order Line."
        )
    ]
