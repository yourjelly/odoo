import json
import hmac
import hashlib

from odoo import http, fields
from odoo.http import request
from werkzeug import exceptions


class PosDeliverooController(http.Controller):
    #ORDER API
    @http.route('/pos_urban_piper/order', methods=['GET'], type="http", auth="public", csrf=False)
    def notification(self, **data):
        deliveroo_provider = request.env['pos.online.delivery.provider'].sudo().search([('code', '=', 'urban_piper')])
        pos_config_sudo = deliveroo_provider.config_ids[0] if deliveroo_provider.config_ids else request.env['pos.config'].sudo().search([('company_id', '=', deliveroo_provider.company_id.id)])[0]
        delivery_order = request.env["pos.order"].sudo().create({
            'delivery_id': 10,
            'delivery_status': 'awaiting',
            'delivery_asap': True,
            'company_id': pos_config_sudo.company_id.id,
            'session_id':   pos_config_sudo.id,
            'sequence_number': 1,
            'pos_reference': request.env['pos.order'].sudo()._generate_unique_id(config_id=pos_config_sudo, prefix="Deliveroo"),
            'date_order': str(fields.Datetime.now()),
            'amount_paid':  321451,
            'amount_total': 321451.00,
            'amount_tax': 0,
            'amount_return': 0,
            'state': 'draft',
            'brand_id': 'zomato',
            'last_order_preparation_change': '{}',
        })
        request.env['bus.bus']._sendone("broadcast", 'pos_order_notify', { 'count': i, 'session_id': pos_config_sudo.id })
        # pos_config_sudo._send_delivery_order_count(delivery_order.id)
        return