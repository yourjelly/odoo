# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import pprint
import werkzeug

from werkzeug.exceptions import Forbidden

from odoo import http
from odoo.http import request


_logger = logging.getLogger(__name__)


class HdfcController(http.Controller):
    _return_url = '/payment/hdfc/return/'
    _cancel_url = '/payment/hdfc/cancel/'

    @http.route(['/payment/hdfc/return', '/payment/hdfc/cancel'], type='http', auth='public', csrf=False)
    def hdfc_return(self, **data):
        _logger.info('HDFC: Entering form_feedback with post data %s', pprint.pformat(data))
        if data:
            tx_sudo = request.env['payment.transaction'].sudo()._get_tx_from_notification_data('hdfc', data)
            self._verify_notification_signature(data, tx_sudo)
            tx_sudo._handle_notification_data('hdfc', data)
        return request.redirect('/payment/status')

    @staticmethod
    def _verify_notification_signature(data, tx_sudo):
        if not data.get('encResp'):
            _logger.warning("Received notification with missing encResp.")
            raise Forbidden()
        decrypted_data = werkzeug.urls.url_decode(tx_sudo._hdfc_decrypt_text(data['encResp']))
        for i in range(1, 6):
            if decrypted_data.get('merchant_param%s' % i) != tx_sudo.hdfc_transaction_verify_key:
                _logger.warning('HDFC transaction verify key did not matched')
                raise Forbidden()
