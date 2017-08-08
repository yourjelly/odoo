# -*- coding: utf-8 -*-

from odoo import http
from odoo.http import request
from odoo. addons.website_sale.controllers.main import WebsiteSale
from odoo.addons.website_sale.models.sale_order import SaleOrder

class WebsiteSale(WebsiteSale):
    
    @http.route()
    def cart_update(self, product_id, add_qty=1, set_qty=0, **kw):

        attribute_name = kw.get('attribute_name')
        value = kw.get('color')
        # print value, ">>>>>>>>>>>>>> value\n"
        attribute_id = request.env['product.attribute'].search([('name', '=', attribute_name)]).id
        product_tmpl_id = request.env['product.product'].search([('id','=',product_id)]).product_tmpl_id
        
        record = request.env['product.attribute.value'].search([('name','=',value),('attribute_id','=',attribute_name)])
        if not record.exists():
        # attribute = request.env['product.product'].search([('id', '=', product_id)]).attribute_line_ids
            result = request.env['product.attribute.value'].sudo().create({
                'name':value, 'attribute_id': attribute_id})
            # print "\nproduct.attribute.value: ", result.id

        # Product = self.env["product.product"]
        # AttributeValues = self.env['product.attribute.value']
        # for tmpl_id in self.with_context(active_test=False):
        #     # adding an attribute with only one value should not recreate product
        #     # write this attribute on every product to make sure we don't lose them
        #     variant_alone = tmpl_id.attribute_line_ids.filtered(lambda line: len(line.value_ids) == 1).mapped('value_ids')
        #     for value_id in variant_alone:
        #         updated_products = tmpl_id.product_variant_ids.filtered(lambda product: value_id.attribute_id not in product.mapped('attribute_value_ids.attribute_id'))
        #         updated_products.write({'attribute_value_ids': [(4, value_id.id)]})

        
        # record1 = request.env['product.product'].search([('product_tmpl_id','=',product_tmpl_id.id),('name','=',value)])
        # if not record1.exists():
        #     test = request.env['product.product'].sudo().create({
        #         'default_code':attribute_name,'product_tmpl_id':product_tmpl_id.id
        #         })
        #     print "product created", product_tmpl_id
        #     for tmpl_id in product_tmpl_id.with_context(active_test=False):
        #         print "inside for loop",tmpl_id.attribute_line_ids[0].value_ids
        #         print "inside for loop",tmpl_id.attribute_line_ids[1].value_ids
        #         variant_alone = tmpl_id.attribute_line_ids.filtered(lambda line: len(line.value_ids) == 1).mapped('value_ids')
        #         print "\n variant alone:",variant_alone, variant_alone.id
        #         # # variant_alone = test.attribute_line_ids.filtered(lambda line: len(line.value_ids) == 1).mapped('value_ids')
        #         # updated_products = product_tmpl_id.product_variant_ids.filtere  d(lambda product: attribute_id not in product.mapped('attribute_value_ids.attribute_id'))
        #         updated_products = tmpl_id.product_variant_ids.filtered(lambda product: variant_alone.attribute_id not in product.mapped('attribute_value_ids.attribute_id'))
        #         print updated_products
        #         updated_products.write({'attribute_value_ids': [(4, variant_alone.id)]})
        #         print "value inserted\n\n", updated_products
        #     print "\n product created", test, test.id,"=new product_id"


        product = super(WebsiteSale, self).cart_update(product_id)
        return product

# class SaleOrder(SaleOrder):
#     def _cart_update(self, product_id=None, line_id=None, add_qty=0, set_qty=0, attributes=None, **kwargs):

#         print kwargs, "\n\n INSIDE SaleOrder of PC"
        
#         # product_id = 42
#         product = super(SaleOrder, self)._cart_update(product_id)
#         return product    









    


