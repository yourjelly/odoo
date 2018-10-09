# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import http
from odoo.http import request


class GraphController(http.Controller):

    @http.route('/product/prefilldata', type='json', auth="public")
    def prefill_rec(self, **kwargs):
        return request.env['res.users'].search([]).mapped('name')

    @http.route('/product/graphdata', type='json', auth="public")
    def search_rec(self, **kwargs):
        filterprod = request.env['crm.team'].search([('user_id', '=', kwargs.get('channelleader'))])
        filterprod._compute_sales_to_invoice()
        valueslist = []
        for rec in filterprod:
            diff_val = abs(rec.invoiced_target - rec.invoiced)
            avg_val = (rec.invoiced_target + rec.invoiced) / 2
            valueslist.append({
                'label': rec.name,
                'values': {
                    'Q1': avg_val - diff_val / 4,
                    'Q2': avg_val,
                    'Q3': avg_val + diff_val / 4,
                    'whisker_low': rec.invoiced,
                    'whisker_high': rec.invoiced_target
                }
            })

        return valueslist
