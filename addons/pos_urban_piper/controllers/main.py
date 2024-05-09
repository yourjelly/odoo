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
            'brand_id': 'zomato',
            'lines': [
                (0, 0, {
                    'product_id': 40,
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
        deliveroo_provider = request.env['pos.online.delivery.provider'].sudo().search([('code', '=', 'urban_piper')])
        pos_config_sudo = deliveroo_provider.config_ids[0] if deliveroo_provider.config_ids else request.env['pos.config'].sudo().search([('company_id', '=', deliveroo_provider.company_id.id)])[0]
        delivery_order = request.env["pos.order"].sudo().create({
            'delivery_id': 786,
            'delivery_status': 'awaiting',
            'delivery_asap': True,
            'company_id': pos_config_sudo.company_id.id,
            'session_id': pos_config_sudo.session_ids[0].id,
            'sequence_number': 1,
            'pos_reference': request.env['pos.order'].sudo()._generate_unique_id(config_id=pos_config_sudo, prefix="Swiggy"),
            'date_order': str(fields.Datetime.now()),
            'amount_paid':  786,
            'amount_total': 786.00,
            'partner_id': 9,
            'amount_tax': 0,
            'name': 'swiggy/0001',
            'amount_return': 0,
            'state': 'draft',
            'brand_id': 'swiggy',
            'lines': [
                (0, 0, {
                    'product_id': 25,
                    'qty': 1.00,
                    'price_unit': 120.5,
                    'discount': 0.0,
                    'price_subtotal': 120.5,
                    'price_subtotal_incl': 120.5,
                }),
                (0, 0, {
                    'product_id': 44,
                    'qty': 1.00,
                    'price_unit': 1.98,
                    'discount': 0.0,
                    'price_subtotal': 1.98,
                    'price_subtotal_incl': 1.98,
                }),
            ],
        })
        request.env['bus.bus']._sendone("broadcast", 'pos_order_notify', { 'count': 1, 'session_id': pos_config_sudo.id, 'brand': 'swiggy' })
        # pos_config_sudo._send_delivery_order_count(delivery_order.id)
        return