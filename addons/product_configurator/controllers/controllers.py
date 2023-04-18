# -*- coding: utf-8 -*-
# from odoo import http


# class ProductConfigurator(http.Controller):
#     @http.route('/product_configurator/product_configurator', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/product_configurator/product_configurator/objects', auth='public')
#     def list(self, **kw):
#         return http.request.render('product_configurator.listing', {
#             'root': '/product_configurator/product_configurator',
#             'objects': http.request.env['product_configurator.product_configurator'].search([]),
#         })

#     @http.route('/product_configurator/product_configurator/objects/<model("product_configurator.product_configurator"):obj>', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('product_configurator.object', {
#             'object': obj
#         })
