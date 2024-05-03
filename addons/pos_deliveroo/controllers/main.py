# coding: utf-8
import json
import hmac
import hashlib

from odoo import http, fields
from odoo.http import request
from werkzeug import exceptions

def formatPrice(price):
    return round(price, 2)

# def formatPrice(price):
#     cents = {
#         "EUR": 2,
#     }
#     return price['fractional'] / 10**cents[price['currency_code']]

class PosDeliverooController(http.Controller):
    #ORDER API
    @http.route('/pos_deliveroo/order', type='http', methods=['GET'], auth='none', csrf=False)
    def notification(self):
        # https://api-docs.deliveroo.com/v2.0/reference/order-events-webhook-1
        # data = json.loads(request.httprequest.data)
        # signature = request.httprequest.headers.get('X-Deliveroo-Hmac-Sha256')
        deliveroo_provider = request.env['pos.online.delivery.provider'].sudo().search([('code', '=', 'deliveroo')])
        # deliveroo_provider = False
        # for deliveroo_provider_sudo in deliveroo_providers_sudo:
        #     if deliveroo_provider_sudo.site_id != int(data['body']['order']['location_id']):
        #         continue
        #     expected_signature = hmac.new(bytes(deliveroo_provider_sudo.webhook_secret, 'utf-8'), msg=bytes(f"{request.httprequest.headers.get('X-Deliveroo-Sequence-Guid')} {request.httprequest.data.decode('utf-8')}", 'utf-8'), digestmod=hashlib.sha256).hexdigest()
        #     if expected_signature == signature:
        #         deliveroo_provider = deliveroo_provider_sudo
        #         break
        if not deliveroo_provider:
            return exceptions.BadRequest()
        pos_config_sudo = deliveroo_provider.config_ids[0] if deliveroo_provider.config_ids else request.env['pos.config'].sudo().search([('company_id', '=', deliveroo_provider.company_id.id)])[0]
        # order = {
        #     'id': 1234,
        #     'display_id': 'ORD-001',
        #     'asap': True,
        #     'confirm_at': '2024-05-02T12:00:00',
        #     'start_preparing_at': '2024-05-02T12:15:00',
        #     'prepare_for': 'John Doe',
        #     'items': [
        #         {
        #             'pos_item_id': 1,
        #             'quantity': 2,
        #             'unit_price': 10.99,
        #             'menu_unit_price': 12.99
        #         },
        #         {
        #             'pos_item_id': 2,
        #             'quantity': 1,
        #             'unit_price': 8.50,
        #             'menu_unit_price': 8.50
        #         }
        #     ],
        #     'partner_order_total': 35.97,
        #     'notes': 'Extra ketchup, please.'
        # }
        # order = {
        #     'id': 1234,
        #     ''
        # }
        # if not pos_config_sudo.has_active_session:
        #     deliveroo_provider._reject_order(order['id'], "closing_early")
        # if order['status'] == 'canceled':
        #     pos_order = request.env['pos.order'].sudo().search([('delivery_id', '=', order['id'])])
        #     if pos_order:
        #         pos_order._post_delivery_reject_order()
        # if not request.env['pos.order'].sudo().search([('delivery_id', '=', order['id'])]):
            # order_prepare_for = order['prepare_for'].replace('T', ' ')[:-1]
            # notes = ''
        amount_paid = "122"
        date_order = str(fields.Datetime.now())
        # if order['order_notes']:
        #     notes += order['order_notes']
        # if order['cutlery_notes']:
        #     if notes:
        #         notes += '\n'
        #     notes += order['cutlery_notes']
        delivery_order = request.env["pos.order"].sudo().create({
            # TODO: add all the missing fields
            'delivery_id': 1213,
            # 'delivery_status': 'awaiting',
            # 'delivery_display': order['display_id'],
            # 'delivery_provider_id': deliveroo_provider.id,
            'delivery_asap': True,
            # 'delivery_confirm_at': order['confirm_at'].replace('T', ' ')[:-1],
            # 'delivery_start_preparing_at': order['start_preparing_at'].replace('T', ' ')[:-1],
            # 'delivery_prepare_for': order_prepare_for,
            'company_id': pos_config_sudo.company_id.id,
            'session_id':   pos_config_sudo.id,
            'sequence_number': 1,
            'pos_reference': request.env['pos.order'].sudo()._generate_unique_id(config_id=pos_config_sudo, prefix="Deliveroo"),
            # the creation of lines should be more precise (taxes and other fields)
            # 'lines': [
            #     (0,0,{
            #         'product_id':   int(line['pos_item_id']),
            #         'qty':          line['quantity'],
            #         'price_unit':   formatPrice(line['unit_price']),
            #         'price_extra':  formatPrice(line['menu_unit_price']) - formatPrice(line['unit_price']), # Price per unit according to the menu (can be different from Unit Price in case of more expensive substitutions, for example)
            #         'discount': 0,
            #         'price_subtotal': formatPrice(line['menu_unit_price']) * line['quantity'],
            #         'price_subtotal_incl': formatPrice(line['menu_unit_price']) * line['quantity'],
            #     })
            #     for line in order['items']
            # ],
            # should take into account the "child lines"
            # 'partner_id': False,
            'date_order': date_order,
            'amount_paid':  2000,
            'amount_total':  32145999,
            'amount_tax': 0,
            'amount_return': 0,
            'state': 'done',
            # 'delivery_note': notes,
            # 'payment_ids': [(0,0,{
            #     'amount': amount_paid,
            #     'payment_date': date_order,
            #     'payment_method_id': deliveroo_provider.payment_method_id.id,
            # })],
            'last_order_preparation_change': '{}',
        })
        pos_config_sudo._send_delivery_order_count(delivery_order.id)
        for i in range(5):
            request.env['bus.bus']._sendone('broadcast', 'pos_order_notify', {'count': i, 'sessionid': pos_config_sudo.id})
        # else:
        #     #See what we should do if the order already exists (like an update or something)
        #     pass

        # request.env['pos.delivery.service'].sudo().search([('service', '=', 'deliveroo')])._new_order(order_id_sudo)
        # find a way do get the proper domain for the delivery service
        # print(request.env['pos.delivery.service'].sudo().search([('service', '=', 'deliveroo')])._refresh_access_token())
        # if data['event'] == 'order.new':
            # ask the preparation display for acceptation or the pos screen
            # accept = True #accept = true for the deliveroo tests
            # if accept:
            #     request.env['pos.delivery.service'].sudo().search([])[0].sudo()._accept_order(data['body']['order']['id'])
            # else:
            #     request.env['pos.delivery.service'].sudo().search([])[0].sudo()._reject_order(data['body']['order']['id'], "busy")
        # if data['event'] == 'order.status_update':
        #     # TODO: in the 'order.status_update' event, deliveroo tells us if they have accepted the order or not
        #     # we should only start preparing the order if it has been accepted by deliveroo
        #     if data['body']['order']['status'] == 'accepted':
        #         pass
        #         #should move the order to preparing state.
        #         # request.env['pos.delivery.service'].sudo().search([])[0].sudo()._confirm_accepted_order(data['body']['order']['id']) -> this should be called when the order goes to the cooking stage.
        #     elif data['body']['order']['status'] == 'cancelled':
        #         #should cancel the order here
        #         pass
        # return
