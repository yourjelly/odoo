# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import http
from odoo.http import request


class openUrl(http.Controller):

    @http.route('/locations/search', auth="public", type="json", website=True)
    def graph_search_data(self, choice, select_value):
        env = request.env['product.template']
        mylist = []
        if choice == 'City':
            results = env.search([('city', '=', select_value)])
            if results:
                for rec in results:
                    if rec.qty_available and rec.name:
                        mylist.append({
                            "Name": rec.name,  # item_name, qty
                            "Qty": rec.qty_available
                        })
        else:
            results = env.search([('name', '=', select_value)])
            if results:
                for rec in results:
                    if rec.qty_available and rec.city.name:
                        mylist.append({
                            "Name": rec.city.name,  # item_location, qty
                            "Qty": rec.qty_available
                        })
        if not mylist:
            return False
        return {
            'data': {'children': [{'children': mylist}]},
            'qty': [select_value] + results.mapped('qty_available')
        }

    @http.route('/dropdown_data', auth="public", type="json")
    def dropdown_data(self):
        product = request.env['product.template'].search([]).mapped('name')
        city = request.env['res.city'].search([]).mapped('name')
        data = {'city': city, 'city_id': city, 'product': product, 'product_id': product}
        return data
