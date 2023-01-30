# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import timedelta, time
from odoo.exceptions import UserError
from odoo import fields, models, _, api
from odoo.tools.float_utils import float_round


class ProductProduct(models.Model):
    _inherit = 'product.product'

    sales_count = fields.Float(compute='_compute_sales_count', string='Sold', digits='Product Unit of Measure')
    sol_qty = fields.Float(string="Sale Order Quantity",
                           compute='_compute_sol_qty',
                           inverse='_inverse_sol_qty',
                           search="_search_sol_qty")
    price_unit = fields.Float(compute="_compute_price_unit")
    sale_order_currency_id = fields.Many2one('res.currency',
                                             compute='_compute_sale_order_currency_id')

    def _compute_sol_qty(self):
        sale_order = self.get_sale_order()
        if sale_order:
            for product in self:
                sol = self.env['sale.order.line'].sudo().search([
                    ('order_id', '=', sale_order.id), ('product_id', '=', product.id)
                ])

                # only show the quantity if there is only one sol and the uom is the same
                # in the sol and the product
                if sol and len(sol) == 1 and sol.product_uom == product.uom_id:
                    product.sol_qty = sol.product_uom_qty

    def _inverse_sol_qty(self):
        self.ensure_one()
        sale_order = self.get_sale_order()
        if sale_order:
            sale_order_line = self.env['sale.order.line'].sudo().search([
                ('order_id', '=', sale_order.id), ('product_id', '=', self.id)
            ])

            if len(sale_order_line) > 1:
                raise UserError(
                    _("Cannot modify quantity: product present in several order lines.")
                )

            if sale_order_line.product_uom and sale_order_line.product_uom != self.uom_id:
                raise UserError(
                    _("Cannot modify quantity: UoM mismatch between sale order line and product.")
                )

            qty = float_round(self.sol_qty, precision_rounding=self.uom_id.rounding)
            sale_order_is_not_readonly = sale_order.state in ['draft', 'sent']

            if qty > 0 and not sale_order_line:  # positive quantity and no line -> create one
                self.env['sale.order.line'].create({
                    'name': self.name,
                    'order_id': sale_order.id,
                    'product_id': self.id,
                    'product_uom_qty': qty,
                    'product_uom': self.uom_id.id,
                    'price_unit': self.lst_price
                })
            elif qty <= 0 and sale_order_line:  # remove existing line if possible, otherwise set to zero
                if sale_order_is_not_readonly:
                    sale_order_line.unlink()
                else:
                    sale_order_line.write({'product_uom_qty': 0})
            elif qty > 0 and sale_order_line:
                sale_order_line.write({'product_uom_qty': qty})

    def _search_sol_qty(self, operator, value):
        if operator not in ['>', '>=', '=', '!=', '<', '<='] or \
           not isinstance(value, int) or \
           value < 0:
            raise UserError(_('Operation not supported'))

        sale_order = self.get_sale_order()
        if sale_order:
            if value == 0 and operator in ['>', '!=']:
                product_ids = self.env['sale.order.line'].sudo().search([
                        ('order_id', '=', sale_order.id), ('product_uom_qty', '>', value),
                    ]).mapped('product_id').mapped('id')
                domain = [('id', 'in', product_ids)]
            elif value == 0 and operator == '>=':
                domain = []
            elif value != 0:
                product_ids = self.env['sale.order.line'].sudo().search([
                        ('order_id', '=', sale_order.id), ('product_uom_qty', operator, value),
                    ]).mapped('product_id').mapped('id')
                domain = [('id', 'in', product_ids)]
            else:
                raise UserError(_('Operation not supported'))
            return domain
        else:
            raise UserError(_('No Sale Order selected'))

    @api.depends('sol_qty')
    def _compute_price_unit(self):
        self.price_unit = 0
        sale_order = self.get_sale_order()
        if sale_order:
            for product in self:
                # three options:
                #   no line with the product in it: defaut computation
                #   several lines with the product in it: default computation as the catalog action does not treat that case
                #   only one line with the product in it: go get the price from the line

                sale_order_line = self.env['sale.order.line'].sudo().search([
                    ('order_id', '=', sale_order.id), ('product_id', '=', product.id)
                ])

                if len(sale_order_line) == 0 or len(sale_order_line) > 1:
                    product.price_unit = product._get_tax_included_unit_price(
                        sale_order.company_id,
                        sale_order.currency_id,
                        sale_order.date_order,
                        'sale',
                        product_price_unit=product.lst_price,
                        fiscal_position=sale_order.fiscal_position_id,
                        product_currency=product.currency_id,
                    )
                else:
                    product.price_unit = sale_order_line.price_unit

    def _compute_sale_order_currency_id(self):
        self.sale_order_currency_id = self.env['res.currency']
        sale_order = self.get_sale_order()

        if sale_order:
            self.sale_order_currency_id = sale_order.currency_id.id

    def get_sale_order(self):
        order_id = self.env.context.get('order_id')
        return self.env['sale.order'].search([('id', '=', order_id)])

    def set_sol_qty(self, qty=1, click_on_record=True):
        self.ensure_one()
        # specify if clicked on the buttons of '+' and '-' or somewhere
        # else on the record
        if click_on_record:
            self.sol_qty += 1
        else:
            self.sol_qty = qty

    def _compute_sales_count(self):
        r = {}
        self.sales_count = 0
        if not self.user_has_groups('sales_team.group_sale_salesman'):
            return r
        date_from = fields.Datetime.to_string(fields.datetime.combine(fields.datetime.now() - timedelta(days=365),
                                                                      time.min))

        done_states = self.env['sale.report']._get_done_states()

        domain = [
            ('state', 'in', done_states),
            ('product_id', 'in', self.ids),
            ('date', '>=', date_from),
        ]
        for group in self.env['sale.report']._read_group(domain, ['product_id', 'product_uom_qty'], ['product_id']):
            r[group['product_id'][0]] = group['product_uom_qty']
        for product in self:
            if not product.id:
                product.sales_count = 0.0
                continue
            product.sales_count = float_round(r.get(product.id, 0), precision_rounding=product.uom_id.rounding)
        return r

    @api.onchange('type')
    def _onchange_type(self):
        if self._origin and self.sales_count > 0:
            return {'warning': {
                'title': _("Warning"),
                'message': _("You cannot change the product's type because it is already used in sales orders.")
            }}

    def action_view_sales(self):
        action = self.env["ir.actions.actions"]._for_xml_id("sale.report_all_channels_sales_action")
        action['domain'] = [('product_id', 'in', self.ids)]
        action['context'] = {
            'pivot_measures': ['product_uom_qty'],
            'active_id': self._context.get('active_id'),
            'search_default_Sales': 1,
            'active_model': 'sale.report',
            'search_default_filter_order_date': 1,
        }
        return action

    def action_edit_template(self):
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'product.template',
            'res_id': self.product_tmpl_id.id,
            'views': [(False, 'form')],
        }

    def _get_invoice_policy(self):
        return self.invoice_policy

    def _get_combination_info_variant(self, add_qty=1, pricelist=False, parent_combination=False):
        """Return the variant info based on its combination.
        See `_get_combination_info` for more information.
        """
        self.ensure_one()
        return self.product_tmpl_id._get_combination_info(self.product_template_attribute_value_ids, self.id, add_qty, pricelist, parent_combination)

    def _filter_to_unlink(self):
        domain = [('product_id', 'in', self.ids)]
        lines = self.env['sale.order.line']._read_group(domain, ['product_id'], ['product_id'])
        linked_product_ids = [group['product_id'][0] for group in lines]
        return super(ProductProduct, self - self.browse(linked_product_ids))._filter_to_unlink()


class ProductAttributeCustomValue(models.Model):
    _inherit = "product.attribute.custom.value"

    sale_order_line_id = fields.Many2one('sale.order.line', string="Sales Order Line", required=True, ondelete='cascade')

    _sql_constraints = [
        ('sol_custom_value_unique', 'unique(custom_product_template_attribute_value_id, sale_order_line_id)', "Only one Custom Value is allowed per Attribute Value per Sales Order Line.")
    ]

class ProductPackaging(models.Model):
    _inherit = 'product.packaging'

    sales = fields.Boolean("Sales", default=True, help="If true, the packaging can be used for sales orders")
