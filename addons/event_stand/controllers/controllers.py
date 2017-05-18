# -*- coding: utf-8 -*-
from odoo import fields, http
from odoo.http import request

class EventStand(http.Controller):
    @http.route(['''/event/<model("event.event", "[('website_exhibitors','=',1)]"):event>/exhibitors'''], type='http', auth="public", website=True)
    def exhibitor_list(self, event, **post):
        slots = request.env['event_stand.stand.slot'].sudo().search([('event_id','=',event.id), ('state','=', 'sold')])
        data = {}
        for slot in slots:
            data.setdefault(slot.name, [])
            data[slot.name].append(slot)
        return request.render("event_stand.exhibitor-list", {
            'event': event,
            'slots': data,
        })


    @http.route(['''/event/<model("event.event", "[('website_exhibitors','=',1)]"):event>/exhibitors/register'''], type='http', auth="public", website=True)
    def exhibitor_form(self, event, **post):
        types = request.env['event_stand.stand.type'].sudo().search([('event_id','=',event.id)])
        stands = request.env['event_stand.stand'].sudo().search([('event_id','=',event.id)])
        return request.render("event_stand.exhibitor-buy", {
            'event': event,
            'types': types,
            'stands': stands
        })

    @http.route(['''/event/<model("event.event", "[('website_exhibitors','=',1)]"):event>/exhibitors/confirm'''], type='http', auth="public", website=True)
    def exhibitor_confirm(self, event, **post):
        print '***', post
        stand = request.env['event_stand.stand'].sudo().browse(int(post['stand_id']))
        order = request.website.sale_get_order(force_create=1)
        cart_values = order.with_context(fixed_price=True)._cart_update(product_id=stand.type_id.product_id.id, add_qty=1, registration_data=[])
        return request.redirect("/shop/checkout")

