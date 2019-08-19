# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import io
import json
import time

try:
    from queue import Queue, Empty
except ImportError:
    from Queue import Queue, Empty  # pylint: disable=deprecated-module

from odoo import http
from odoo.http import request, Response


class StarController(http.Controller):

    receipt_queues = []
    receipts_printing = []

    @http.route('/pos_star_cloud/<int:pos_session>', type='http', auth='public', csrf=False)
    def pos_star_cloud(self, pos_session, **kwargs):
        if pos_session not in self.receipt_queues:
            self.receipt_queues[pos_session] = Queue()

        if request.httprequest.data.decode():
            # data = json.loads(request.httprequest.data.decode())
            try:
                # TODO ANP: Get delay from data
                receipt, timestamp = self.receipt_queues[pos_session].get(True, 10)
                if time.time() - timestamp < 5:
                    self.receipts_printing[pos_session] = receipt
                    return json.dumps({
                        'jobReady': 'true',
                        'mediaTypes': ['image/png'],
                    })
            except Empty:
                pass
            return json.dumps({'jobReady': 'false'})
        else:
            im = io.BytesIO(self.receipts_printing[pos_session])
            #Image.open(BytesIO(base64.b64decode(value)))
            # im = Image.open('/home/odoo/Pictures/img.jpg')
            # img_result = io.BytesIO()
            # im.save(img_result, 'png')
            return Response(im.getvalue(), mimetype='image/png')

    @http.route('/star_print_receipt', type='http', auth='user')
    def print_receipt(self, pos_session, receipt):
        self.receipt_queues[pos_session].put((base64.b64decode(receipt), timestamp))

'''
WORKS :
if request.httprequest.data.decode():
    # data = json.loads(request.httprequest.data.decode())
    datare = {
        'jobReady': 'true',
        'mediaTypes': ['text/plain'],
        'uniqueID': 'StarOne',
        'SetID': 'StarTwo',
    }
    return json.dumps(datare)
else:
    return Response('Test', mimetype='text/plain')
'''
