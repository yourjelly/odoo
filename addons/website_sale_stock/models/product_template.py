# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models, api, _
from odoo.exceptions import ValidationError
from odoo.tools.translate import html_translate
from odoo.tools import is_html_empty


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    allow_to_order = fields.Selection([
        ('available', 'Allow the user to order only if there is enough quantity on hand for the product'),
        ('always', 'Allow the user to order even if there is no quantity on hand for the product'),
    ], string='Allow to order', default='always')
    available_threshold = fields.Float(string='Availability Threshold', default=5.0)

    show_availability = fields.Selection([
        ('always', 'Always'),
        ('threshold', 'Below Threshold'),
        ('never', 'Never'),
    ], string='Show availability', default='always')
    available_message = fields.Html(string="In Stock", translate=html_translate, default='')
    out_of_stock_message = fields.Html(string="Out of Stock", translate=html_translate, default='')
    threshold_message = fields.Html(string="Below Threshold", translate=html_translate, default='')

    @api.constrains('available_message', 'out_of_stock_message', 'threshold_message')
    def _check_stock_message(self):
        for record in self:
            try:
                record.available_message.format(qty='', unit='')
                record.out_of_stock_message.format(qty='', unit='')
                record.threshold_message.format(qty='', unit='')
            except:
                raise ValidationError(_("You did not use correctly one of the two variables: %s or %s") % ("{qty}", "{unit}"))

    def _get_stock_message(self, key):
        website = self.env['website'].get_current_website()
        if key == 'available':
            return self.available_message if not is_html_empty(self.available_message) else website.available_message
        if key == 'out_of_stock':
            return self.out_of_stock_message if not is_html_empty(self.out_of_stock_message) else website.out_of_stock_message
        if key == 'threshold':
            return self.threshold_message if not is_html_empty(self.threshold_message) else website.threshold_message
        return ''

    def _get_combination_info(self, combination=False, product_id=False, add_qty=1, pricelist=False, parent_combination=False, only_template=False):
        combination_info = super(ProductTemplate, self)._get_combination_info(
            combination=combination, product_id=product_id, add_qty=add_qty, pricelist=pricelist,
            parent_combination=parent_combination, only_template=only_template)

        if not self.env.context.get('website_sale_stock_get_quantity'):
            return combination_info

        combination_info['is_published'] = self.is_published

        if combination_info['product_id']:
            product = self.env['product.product'].sudo().browse(combination_info['product_id'])
            website = self.env['website'].get_current_website()
            product_with_context = product.with_context(warehouse=website.warehouse_id.id)

            free_qty = product_with_context.free_qty
            incoming_qty = product_with_context.incoming_qty
            incoming_date = product_with_context._get_next_incoming_move_date()
            uom_name = product.uom_id.name
            cart_qty = product.cart_qty
            remaining_qty_formatted = self.env['ir.qweb.field.float'].value_to_html(free_qty - cart_qty, {'precision': 0})

            combination_info.update({
                'free_qty': free_qty,
                'product_type': product.type,
                'allow_to_order': self.allow_to_order,
                'incoming_qty': incoming_qty,
                'incoming_date': fields.Date.to_string(incoming_date),
                'available_threshold': self.available_threshold,
                'product_template': self.id,
                'cart_qty': cart_qty,
                'uom_name': uom_name,
                'show_availability': self.show_availability,
                'available_message': self._get_stock_message('available').format(qty=remaining_qty_formatted, unit=uom_name),
                'out_of_stock_message': self._get_stock_message('out_of_stock').format(qty=remaining_qty_formatted, unit=uom_name),
                'threshold_message': self._get_stock_message('threshold').format(qty=remaining_qty_formatted, unit=uom_name),
            })
        else:
            product_template = self.sudo()
            combination_info.update({
                'free_qty': 0,
                'product_type': product_template.type,
                'allow_to_order': product_template.allow_to_order,
                'available_threshold': product_template.available_threshold,
                'product_template': product_template.id,
                'cart_qty': 0,
            })

        return combination_info
