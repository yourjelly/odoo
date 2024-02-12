# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _, api

class ProjectProduct(models.Model):
    _name = 'project.product'

    task_id = fields.Many2one(comodel_name='project.task')
    product_id = fields.Many2one('product.product', 'Product', required=True)
    price = fields.Float('Price', related='product_id.standard_price', readonly=False)
    quantity = fields.Integer('Quantity')
    partner_id = fields.Many2one('res.partner', 'Vendor')
    route_id = fields.Many2one('stock.route', string="Route")
    order_created = fields.Boolean()

    def button_order(self):
        self.order_created = True
        existing_order = self.env['purchase.order'].search([
            ('partner_id', '=', self.partner_id.id),
            ('state', 'in', ['draft', 'sent'])
        ], limit=1)

        if existing_order:
            order_line_data = {
                'order_id': existing_order.id,
                # 'route_id': self.route_id.id,
                'product_id': self.product_id.id,
                'price_unit': self.price,
                'product_qty': self.quantity,
                'name': self.product_id.name,
            }

            order_line = self.env['purchase.order.line'].create(order_line_data)
            notification = {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': _('Product Added to Existing Purchase Order'),
                    'message': _('Product has been added to the existing purchase order.'),
                    'sticky': False,
                }
            }
        else:
            order_data = {
                'partner_id': self.partner_id.id,
                'date_order': fields.Datetime.now()
            }
            order = self.env['purchase.order'].create(order_data)

            order_line_data = {
                'order_id': order.id,
                # 'route_id': self.route_id.id,
                'product_id': self.product_id.id,
                'price_unit': self.price,
                'product_qty': self.quantity,
                'name': self.product_id.name,
            }

            order_line = self.env['purchase.order.line'].create(order_line_data)
            notification = {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': _('New Purchase Order Created'),
                    'message': _('A new purchase order has been created.'),
                    'sticky': False,
                }
            }

        return notification
