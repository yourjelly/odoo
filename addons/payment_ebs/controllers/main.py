# -*- coding: utf-8 -*-

import logging
import pprint
import werkzeug

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class EbsController(http.Controller):
    _return_url = '/payment/ebs/return/'
    payment_status = {
        '0': 'success',
        '2': 'failed'
    }

    def ebs_validate_data(self, **post):
        res = False
        resp = self.payment_status.get(post.get('ResponseCode'))
        if resp == 'success':
            _logger.info('EBS: validated data')
        elif resp == 'failed':
            _logger.warning('EBS: answered FAIL on data verification')
        else:
            _logger.warning('EBS: unrecognized ebs answer, received %s instead of SUCCESS or FAIL' % resp)
        res = request.env['payment.transaction'].sudo().form_feedback(post, 'ebs')
        return res

    @http.route('/payment/ebs/return', type='http', auth="none", methods=['POST', 'GET'], csrf=False)
    def ebs_dpn(self, redirect_url=False, **post):
        """ EBS Return """
        _logger.info('Beginning EBS Return form_feedback with post data %s' % pprint.pformat(post))
        self.ebs_validate_data(**post)
        return werkzeug.utils.redirect(redirect_url or '/')
