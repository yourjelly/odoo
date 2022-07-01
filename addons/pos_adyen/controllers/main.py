# coding: utf-8
import logging
import pprint
import json
from odoo import fields, http
from odoo.http import request

_logger = logging.getLogger(__name__)


class PosAdyenController(http.Controller):
    @http.route('/pos_adyen/notification', type='json', methods=['POST'], auth='none', csrf=False)
    def notification(self):
        data = json.loads(request.httprequest.data)
        _logger.info(data)

        # ignore if it's not a response to a sales request
        if data.get('SaleToPOIResponse'):
            terminal_identifier = data['SaleToPOIResponse']['MessageHeader']['POIID']
        elif data.get('notificationItems'):
            terminal_identifier = data.get('notificationItems')[0].get('NotificationRequestItem').get('additionalData').get('terminalId')
        else:
            return

        _logger.info('notification received from adyen:\n%s', pprint.pformat(data))
        payment_method = request.env['pos.payment.method'].sudo().search([('adyen_terminal_identifier', '=', terminal_identifier)], limit=1)

        if payment_method:
            # These are only used to see if the terminal is reachable,
            # store the most recent ID we received.
            if data['SaleToPOIResponse'].get('DiagnosisResponse'):
                payment_method.adyen_latest_diagnosis = data['SaleToPOIResponse']['MessageHeader']['ServiceID']
            else:
                payment_method.adyen_latest_response = json.dumps(data)
            _logger.info('notification writed from adyen\n%s', data)
        else:
            _logger.error('received a message for a terminal not registered in Odoo: %s', terminal_identifier)
