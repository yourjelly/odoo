# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import timedelta
from odoo import api, fields, models, _
from odoo.addons.base.models.res_partner import WARNING_MESSAGE, WARNING_HELP
from odoo.tools.float_utils import float_round
from dateutil.relativedelta import relativedelta


class ProductTemplate(models.Model):
    _name = 'product.template'
    _inherit = 'product.template'

    property_account_creditor_price_difference = fields.Many2one(
        'account.account', string="Price Difference Account", company_dependent=True,
        help="This account is used in automated inventory valuation to "\
             "record the price difference between a purchase order and its related vendor bill when validating this vendor bill.")
    purchased_product_qty = fields.Float(compute='_compute_purchased_product_qty', string='Purchased')
    purchase_method = fields.Selection([
        ('purchase', 'On ordered quantities'),
        ('receive', 'On received quantities'),
    ], string="Control Policy", help="On ordered quantities: Control bills based on ordered quantities.\n"
        "On received quantities: Control bills based on received quantities.", default="receive")
    purchase_line_warn = fields.Selection(WARNING_MESSAGE, 'Purchase Order Line', help=WARNING_HELP, required=True, default="no-message")
    purchase_line_warn_msg = fields.Text('Message for Purchase Order Line')

    def _compute_purchased_product_qty(self):
        for template in self:
            template.purchased_product_qty = float_round(sum([p.purchased_product_qty for p in template.product_variant_ids]), precision_rounding=template.uom_id.rounding)

    @api.model
    def get_import_templates(self):
        res = super(ProductTemplate, self).get_import_templates()
        if self.env.context.get('purchase_product_template'):
            return [{
                'label': _('Import Template for Products'),
                'template': '/purchase/static/xls/product_purchase.xls'
            }]
        return res

    def action_view_po(self):
        action = self.env.ref('purchase.action_purchase_order_report_all').read()[0]
        action['domain'] = ['&', ('state', 'in', ['purchase', 'done']), ('product_tmpl_id', 'in', self.ids)]
        action['context'] = {
            'graph_measure': 'qty_ordered',
            'search_default_orders': 1,
            'time_ranges': {'field': 'date_approve', 'range': 'last_365_days'}
        }
        return action


class ProductProduct(models.Model):
    _name = 'product.product'
    _inherit = 'product.product'

    purchased_product_qty = fields.Float(compute='_compute_purchased_product_qty', string='Purchased')
    product_pol_quantity = fields.Integer(compute='_compute_product_pol_quantity', string='Purchase Order Line Quantity')

    def _compute_purchased_product_qty(self):
        date_from = fields.Datetime.to_string(fields.datetime.now() - timedelta(days=365))
        domain = [
            ('state', 'in', ['purchase', 'done']),
            ('product_id', 'in', self.ids),
            ('date_order', '>', date_from)
        ]
        PurchaseOrderLines = self.env['purchase.order.line'].search(domain)
        order_lines = self.env['purchase.order.line'].read_group(domain, ['product_id', 'product_uom_qty'], ['product_id'])
        purchased_data = dict([(data['product_id'][0], data['product_uom_qty']) for data in order_lines])
        for product in self:
            if not product.id:
                product.purchased_product_qty = 0.0
                continue
            product.purchased_product_qty = float_round(purchased_data.get(product.id, 0), precision_rounding=product.uom_id.rounding)

    def _compute_product_pol_quantity(self):
        order_id = self._context.get("active_id")
        if order_id:
            order = self.env['purchase.order'].browse(order_id)
            product_map = {}
            for pol in order.order_line:
                if not product_map.get(pol.product_id.id):
                    product_map[pol.product_id.id] = []
                product_map[pol.product_id.id].append(pol.product_qty)
            for product in self:
                product.product_pol_quantity = sum(product_map.get(product.id,[0]))
        else:
            self.product_pol_quantity = False

    def action_view_po(self):
        action = self.env.ref('purchase.action_purchase_order_report_all').read()[0]
        action['domain'] = ['&', ('state', 'in', ['purchase', 'done']), ('product_id', 'in', self.ids)]
        action['context'] = {
            'search_default_last_year_purchase': 1,
            'search_default_status': 1, 'search_default_order_month': 1,
            'graph_measure': 'qty_ordered'
        }
        return action

    def product_add_pol_quantity(self):
        self.ensure_one()
        order_id = self._context.get("active_id")
        if order_id:
            purchase_order = self.env['purchase.order'].browse(order_id)
            order_line = self.env['purchase.order.line'].search([('order_id', '=', order_id), ('product_id', '=', self.id)], limit=1)
            if not order_line: # Create new purchase order line
                # determine vendor (real supplier, sharing the same partner as the one from the PO, but with more accurate informations like validity, quantity, ...)
                # Note: one partner can have multiple supplier info for the same product
                supplierinfo = self._select_seller(
                    partner_id=purchase_order.partner_id,
                    quantity=1,
                    date=purchase_order.date_order and purchase_order.date_order.date(), # and purchase_order.date_order[:10],
                    uom_id=self.uom_po_id
                )
                fpos = purchase_order.fiscal_position_id
                taxes = fpos.map_tax(self.supplier_taxes_id) if fpos else self.supplier_taxes_id
                if taxes:
                    taxes = taxes.filtered(lambda t: t.company_id.id == self.company_id.id)

                # compute unit price
                price_unit = 0.0
                if supplierinfo:
                    price_unit = self.env['account.tax'].sudo()._fix_tax_included_price_company(supplierinfo.price, self.supplier_taxes_id, taxes, purchase_order.company_id)
                    if purchase_order.currency_id and supplierinfo.currency_id != purchase_order.currency_id:
                        price_unit = supplierinfo.currency_id.compute(price_unit, purchase_order.currency_id)

                vals = {
                    'name': '[%s] %s' % (self.default_code, self.name) if self.default_code else self.name,
                    'product_qty': 1,
                    'product_id': self.id,
                    'product_uom': self.uom_po_id.id,
                    'price_unit': price_unit,
                    'date_planned': fields.Date.from_string(purchase_order.date_order) + relativedelta(days=int(supplierinfo.delay)),
                    'taxes_id': [(6, 0, taxes.ids)],
                    'order_id': purchase_order.id,
                }
                order_line = self.env['purchase.order.line'].create(vals)
            else:   # increment purchase order line quantities
                vals = {
                    'product_qty': order_line.product_qty + 1
                }
                order_line.write(vals)
        return True

    def product_remove_pol_quantity(self):
        self.ensure_one()
        order_id = self._context.get("active_id")
        if order_id:
            order_line = self.env['purchase.order.line'].search([('order_id', '=', order_id), ('product_id', '=', self.id)], limit=1)
            if order_line:
                vals = {
                    'product_qty': order_line.product_qty - 1
                }
                order_line.write(vals)
        return True


class ProductCategory(models.Model):
    _inherit = "product.category"

    property_account_creditor_price_difference_categ = fields.Many2one(
        'account.account', string="Price Difference Account",
        company_dependent=True,
        help="This account will be used to value price difference between purchase price and accounting cost.")


class ProductSupplierinfo(models.Model):
    _inherit = "product.supplierinfo"

    @api.onchange('name')
    def _onchange_name(self):
        self.currency_id = self.name.property_purchase_currency_id.id or self.env.company.currency_id.id
