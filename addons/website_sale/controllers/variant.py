# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.http import request, route

from odoo.addons.sale.controllers.variant import VariantController


class WebsiteSaleVariantController(VariantController):

    @route(['/sale/get_combination_info_website'], type='json', auth="public", methods=['POST'], website=True)
    def get_combination_info_website(self, product_template_id, product_id, combination, add_qty, **kw):
        """Special route to use website logic in get_combination_info override.
        This route is called in JS by appending _website to the base route.
        """
        kw.pop('pricelist_id')
        ProductTemplate = request.env['product.template']
        combination_info = self.get_combination_info(
            product_template_id,
            product_id,
            combination,
            add_qty,
            request.website.get_current_pricelist(),
            **kw,
        )

        if request.website.google_analytics_key:
            combination_info['product_tracking_info'] = ProductTemplate.get_google_analytics_data(
                combination)

        combination_info['carousel'] = request.env['ir.ui.view']._render_template(
            'website_sale.shop_product_carousel',
            {
                'product': ProductTemplate.browse(combination_info['product_template_id']),
                'product_variant': request.env['product.product'].browse(combination_info['product_id']),
            }
        )

        return combination_info

    @route(auth="public")
    def create_product_variant(self, *args, **kwargs):
        """Override because on the website the public user must access it."""
        return super().create_product_variant(*args, **kwargs)
