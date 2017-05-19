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
    def exhibitor_form(self, event, conflict=0, **post):
        types = request.env['event_stand.stand.type'].sudo().search([('event_id','=',event.id)])
        stands = request.env['event_stand.stand'].sudo().search([('event_id','=',event.id), ('state','=','available')])
        return request.render("event_stand.exhibitor-buy", {
            'event': event,
            'types': types,
            'conflict': conflict,
            'stands': stands
        })

    @http.route(['''/event/<model("event.event", "[('website_exhibitors','=',1)]"):event>/exhibitors/confirm'''], type='http', auth="public", website=True)
    def exhibitor_confirm(self, event, **post):
        stand_id = int(post.get('stand_id', 0))
        if not stand_id:
            return request.redirect("/event/"+str(event.id)+"/exhibitors/register?conflict=1")
        stand = request.env['event_stand.stand'].sudo().browse(stand_id)
        slot_obj = request.env['event_stand.stand.slot'].sudo()
        order = request.website.sale_get_order(force_create=1)
        cart_values = order.with_context(fixed_price=True)._cart_update(
            product_id=stand.type_id.product_id.id, 
            set_qty=int(post.get('slot_number',1)), 
            registration_data=[])

        extra_name=''
        if stand.type_id.slot_all:
            slots = stand.slot_ids
        else:
            extra_name='\n\n'
            ids = []
            for i in range(int(post.get('slot_number',0))):
                if post.get('slot_id_'+str(i), False):
                    sid = int(post['slot_id_'+str(i)])
                    extra_name+=slot_obj.browse(sid).name+': '+post.get('track_title_'+str(i),'')+'\n'
                    ids.append(sid)
            slots = slot_obj.browse(ids)

        if (stand.state <> 'available') or slots.filtered(lambda x: x.state<>'available'):
            return request.redirect("/event/"+str(event.id)+"/exhibitors/register?conflict=1")

        if cart_values.get('line_id'):
            line = request.env['sale.order.line'].sudo().browse(cart_values.get('line_id'))
            line.name = line.product_id.name + "\n"+ stand.type_id.name + ": "+stand.name+extra_name
            line.stand_id = stand.id
            line.slot_ids = [(6,0, slots.mapped('id'))]
        result = request.redirect("/shop/checkout")
        return result

    @http.route(['''/event/exhibitors/onchange'''], type='json', auth="public")
    def exhibitor_onchange(self, type_id, stand_id=False, **kwargs):
        if not type_id: return {}
        sobj = request.env['event_stand.stand'].sudo()
        type_id = request.env['event_stand.stand.type'].sudo().browse(int(type_id))
        event = type_id.event_id
        stands = sobj.search([('event_id','=',event.id), ('type_id','=',int(type_id))])
        slots = []
        if stands and not stand_id: stand_id = stands[0]
        if stand_id:
            stand = request.env['event_stand.stand'].sudo().browse(int(stand_id))
            slots = stand.slot_ids.mapped(lambda x: (x.id, x.name, x.state=='available'))
        result = {
            'stands': stands.mapped(lambda x: (x.id, x.name, x.state=='available')), 
            'slots': slots,
            'description': type_id.description,
            'show_slot': stand_id and not type_id.slot_all,
            'price': type_id.price,
            'price_upsell': type_id.price_upsell,
            'price_product': type_id.product_id.list_price,
        }
        return result

