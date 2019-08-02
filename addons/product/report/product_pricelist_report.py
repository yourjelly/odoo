# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class report_product_pricelist(models.AbstractModel):
    _name = 'report.product.report_pricelist'
    _description = 'Product Price List Report'

    @api.model
    def _get_report_values(self, docids, data=None):
        pricelist_id = data['pricelist_id'] and int(data['pricelist_id']) or None
        product_ids = [int(p) for p in data['active_ids'].split(',')]
        quantity = data['quantity'] and int(data['quantity']) or 1
        return self.with_context(active_model=data['active_model'])._get_report_data(pricelist_id, product_ids, quantity, 'pdf')

    @api.model
    def get_html(self):
        result = self._get_report_data(
            self.env.context.get('pricelist_id'),
            self.env.context.get("active_ids"),
            self.env.context.get('product_qty') or 1
        )
        return self.env.ref('product.report_pricelist_page').render(result)

    def _get_report_data(self, pricelist_id, product_ids, quantity, report_type='html'):
        products = []
        ProductPricelist = self.env['product.pricelist']
        pricelist = ProductPricelist.browse(pricelist_id)
        if not pricelist:
            pricelist = ProductPricelist.search([], limit=1)

        ProductProduct = self.env['product.product'].with_context(
            pricelist=pricelist.id,
            quantity=quantity
        )
        if self.env.context.get('active_model') == 'product.product':
            products = ProductProduct.search_read([('id', 'in', product_ids)], ['name', 'price'])
        else:
            products = self.env['product.template'].with_context(
                pricelist=pricelist.id,
                quantity=quantity
            ).search_read([('id', 'in', product_ids)], ['name', 'price', 'product_variant_ids'])
            for product in products:
                product['variants'] = ProductProduct.search_read([('id', 'in', product['product_variant_ids'])], ['display_name', 'price'])

        return {
            'pricelist': pricelist,
            'products': products,
            'quantity': quantity,
            'active_model': self.env.context.get('active_model'),
            'is_html_type': report_type == 'html',
        }
