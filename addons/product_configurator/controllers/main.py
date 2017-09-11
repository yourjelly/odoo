# -*- coding: utf-8 -*-

from odoo import http
from odoo.http import request
from odoo. addons.website_sale.controllers.main import WebsiteSale

class WebsiteSale(WebsiteSale):
    
    @http.route()
    def cart_update(self, product_id, add_qty=1, set_qty=0, **kw):

        attribute_name = kw.get('attribute_name')
        value = kw.get('color')
        attribute_id = request.env['product.attribute'].search([('name', '=', attribute_name)]).id
        product_tmpl_id = request.env['product.product'].search([('id','=',product_id)]).product_tmpl_id
        
        record = request.env['product.attribute.value'].search([('name','=',value),('attribute_id','=',attribute_name)])
        if not record.exists():
            result = request.env['product.attribute.value'].sudo().create({
                'name':value, 'attribute_id': attribute_id})
            
        product = super(WebsiteSale, self).cart_update(product_id)
        return product









    


