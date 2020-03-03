# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import http,tools
from odoo.http import request
from odoo.modules.module import get_module_resource
import base64
import requests

from odoo.addons.sale.controllers.variant import VariantController

class WebsiteSaleVariantController(VariantController):
    @http.route(['/sale/get_combination_info_website'], type='json', auth="public", methods=['POST'], website=True)
    def get_combination_info_website(self, product_template_id, product_id, combination, add_qty, **kw):
        """Special route to use website logic in get_combination_info override.
        This route is called in JS by appending _website to the base route.
        """
        kw.pop('pricelist_id')
        res = self.get_combination_info(product_template_id, product_id, combination, add_qty, request.website.get_current_pricelist(), **kw)

        carousel_view = request.env['ir.ui.view'].render_template('website_sale.shop_product_carousel',
            values={
                'product': request.env['product.template'].browse(res['product_template_id']),
                'product_variant': request.env['product.product'].browse(res['product_id']),
                'product_template_id':product_template_id,
            })
        res['carousel'] = carousel_view
        return res

    @http.route(auth="public")
    def create_product_variant(self, product_template_id, product_template_attribute_value_ids, **kwargs):
        """Override because on the website the public user must access it."""
        return super(WebsiteSaleVariantController, self).create_product_variant(product_template_id, product_template_attribute_value_ids, **kwargs)

    @http.route(['/sale/product_media_website'],type='json',auth="user", methods=['POST'], website=True)
    def set_image_or_video(self,product_template_id,img_src=None,video_url=None):
        if video_url:
            return request.env['product.image'].create({
            'name':request.env['product.template'].browse(int(product_template_id)).name,
            'image_1920':request.env['product.image'].set_thumbnail_image(video_url=video_url),
            'video_url':video_url,
            'product_tmpl_id':int(product_template_id),
            })
        response = requests.get(img_src, timeout=5, params=None)
        response.raise_for_status()
        if response.status_code != 200:
            return False
        return request.env['product.image'].create({
            'name':request.env['product.template'].browse(int(product_template_id)).name,
            'image_1920':base64.b64encode(response.content),
            'product_tmpl_id':int(product_template_id),
            })
