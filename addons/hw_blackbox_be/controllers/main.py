# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import serial

import openerp
from openerp import http

import openerp.addons.hw_proxy.controllers.main as hw_proxy

class ScaleDriver(hw_proxy.Proxy):
    @http.route('/hw_proxy/request_fdm_identification/', type='json', auth='none', cors='*')
    def request_fdm_identification(self):
        return "hello!"
        # if good:
        #     return {'weight': scale_thread.get_weight(), 'unit':'kg', 'info': scale_thread.get_weight_info()}
        # return None
