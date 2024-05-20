import json
import hmac
import hashlib

from odoo import http, fields
from odoo.http import request
from werkzeug import exceptions


class PosDeliverooController(http.Controller):
    #ORDER API
    @http.route('/pos_urban_piper/order/zomato', methods=['GET'], type="http", auth="public", csrf=False)
    def notification(self, **data):
        deliveroo_provider = request.env['pos.online.delivery.provider'].sudo().search([('code', '=', 'urban_piper')])
        pos_config_sudo = deliveroo_provider.config_ids[0] if deliveroo_provider.config_ids else request.env['pos.config'].sudo().search([('company_id', '=', deliveroo_provider.company_id.id)])[0]
        delivery_order = request.env["pos.order"].sudo().create({
            'delivery_id': 10,
            'delivery_status': 'awaiting',
            'delivery_asap': True,
            'company_id': pos_config_sudo.company_id.id,
            'session_id': pos_config_sudo.session_ids[0].id,
            'sequence_number': 1,
            'pos_reference': request.env['pos.order'].sudo()._generate_unique_id(config_id=pos_config_sudo, prefix="Zomato"),
            'date_order': str(fields.Datetime.now()),
            'amount_paid':  321451,
            'amount_total': 321451.00,
            'partner_id': 9,
            'amount_tax': 0,
            'name': 'zomato/0001',
            'amount_return': 0,
            'state': 'draft',
            'delivery_partner': 'zomato',
            'lines': [
                (0, 0, {
                    'product_id': 58,
                    'qty': 1.00,
                    'price_unit': 1.98,
                    'discount': 0.0,
                    'price_subtotal': 1.98,
                    'price_subtotal_incl': 1.98,
                }),
            ],
        })
        request.env['bus.bus']._sendone("broadcast", 'pos_order_notify', { 'count': 1, 'session_id': pos_config_sudo.id, 'brand': 'zomato' })
        # pos_config_sudo._send_delivery_order_count(delivery_order.id)
        return

    @http.route('/pos_urban_piper/order/swiggy', methods=['GET'], type="http", auth="public", csrf=False)
    def notification_swiggy(self, **data):
        data = {
            "body": {
                "order": {
                "display_id": "jain",
                "id": "123456789",
                "location_id": "1019",
                "status": "pending",
                "order_notes": "Do not make it spicy and add extra chees",
                "asap": True,
                "items": [
                    {
                    "pos_item_id": "44",
                    "quantity": 2
                    }
                ]
                }
            }
        }
        deliveroo_provider = request.env['pos.online.delivery.provider'].sudo().search([('code', '=', 'urban_piper')])
        pos_config_sudo = deliveroo_provider.config_ids[0] if deliveroo_provider.config_ids else request.env['pos.config'].search([('company_id', '=', deliveroo_provider.company_id.id)])[1]
        order = data['body']['order']
        if not pos_config_sudo.has_active_session:
            deliveroo_provider._reject_order(order['id'], "closing_early")
        if order['status'] == 'canceled':
            pos_order = request.env['pos.order'].sudo().search([('delivery_id', '=', order['id'])])
            if pos_order:
                pos_order._post_delivery_reject_order()
        order_prepare_for = str(fields.Datetime.now())
        notes = ''
        amount_paid = 299.00
        date_order = str(fields.Datetime.now())
        if order['order_notes']:
            notes += order['order_notes']
        delivery_order = request.env["pos.order"].sudo().create({
            'delivery_id': order['id'],
            'delivery_status': 'awaiting',
            'delivery_display': order['display_id'],
            'delivery_provider_id': deliveroo_provider.id,
            'delivery_asap': order['asap'],
            'delivery_confirm_at': str(fields.Datetime.now()),
            'delivery_start_preparing_at': str(fields.Datetime.now()),
            'delivery_prepare_for': order_prepare_for,
            'company_id': pos_config_sudo.current_session_id.company_id.id,
            'session_id':   pos_config_sudo.current_session_id.id,
            'sequence_number':pos_config_sudo.current_session_id.sequence_number,
            'pos_reference': request.env['pos.order'].sudo()._generate_unique_id(config_id=pos_config_sudo, prefix="Deliveroo"),
            'lines': [
                (0, 0, {
                    'product_id': 58,
                    'qty': 1.00,
                    'price_unit': 1.98,
                    'discount': 0.0,
                    'price_subtotal': 1.98,
                    'price_subtotal_incl': 1.98,
                }),
            ],
            'date_order': date_order,
            'amount_paid':  amount_paid,
            'amount_total':  312.00,
            'amount_tax': 0,
            'amount_return': 0,
            'state': 'draft',
            'delivery_note': notes,
            # 'payment_ids': [(0,0,{
            #     'amount': amount_paid,
            #     'payment_date': date_order,
            #     'payment_method_id': 2,
            # })],
            'last_order_preparation_change': '{}',
        })
        pos_config_sudo._send_delivery_order_count(delivery_order.id)
        return


    @http.route('/pos_urban_piper/order/test', methods=['GET'], type="http", auth="public", csrf=False)
    def notification(self, **data):
        deliveroo_provider = request.env['pos.online.delivery.provider'].sudo().search([('code', '=', 'urban_piper')])
        pos_config_sudo = deliveroo_provider.config_ids[0] if deliveroo_provider.config_ids else request.env['pos.config'].sudo().search([('company_id', '=', deliveroo_provider.company_id.id)])[1]
        amount_paid = 299.00
        date_order = str(fields.Datetime.now())
        delivery_order = request.env["pos.order"].sudo().create({
            'delivery_id': 10,
            'delivery_status': 'awaiting',
            'delivery_asap': True,
            'company_id': pos_config_sudo.company_id.id,
            'session_id': pos_config_sudo.session_ids[0].id,
            'sequence_number': 1,
            'pos_reference': request.env['pos.order'].sudo()._generate_unique_id(config_id=pos_config_sudo, prefix="Zomato"),
            'date_order': str(fields.Datetime.now()),
            'amount_paid':  321451,
            'amount_total': 321451.00,
            'partner_id': 9,
            'amount_tax': 0,
            'name': 'zomato/0001',
            'amount_return': 0,
            'state': 'draft',
            'delivery_partner': 'zomato',
            'lines': [
                (0, 0, {
                    'product_id': 58,
                    'qty': 1.00,
                    'price_unit': 1.98,
                    'discount': 0.0,
                    'price_subtotal': 1.98,
                    'price_subtotal_incl': 1.98,
                }),
            ],
            # 'payment_ids': [(0,0,{
            #     'amount': amount_paid,
            #     'payment_date': date_order,
            #     'payment_method_id': deliveroo_provider.payment_method_id.id,
            # })],
        })
        # request.env['bus.bus']._sendone("broadcast", 'pos_order_notify', { 'count': 1, 'session_id': pos_config_sudo.id, 'brand': 'zomato' })
        # pos_config_sudo._send_delivery_order_count(delivery_order.id)
        pos_config_sudo._send_delivery_order_count(delivery_order.id)
        return