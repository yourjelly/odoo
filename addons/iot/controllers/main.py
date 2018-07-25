# -*- coding: utf-8 -*-
#import logging
#import os
#import re
#import time
#from collections import namedtuple
#from os import listdir
#from threading import Thread, Lock
from odoo import http
from odoo.http import request

class IoTController(http.Controller):

    @http.route('/iot1', type='http', auth='public', csrf=False)
    def post_measurement(self, iot_identifier, device_identifier, message):
        values = {
            'iot_identifier': iot_identifier,
            'device_identifier': device_identifier,
            'message': message
            }
        existing_box = request.env['iot.box'].sudo().search([('identifier', '=', iot_identifier)], limit=1)
        if existing_box:
            values['iot_id'] = existing_box.id

        existing_device = request.env['iot.device'].sudo().search([('identifier', '=', device_identifier)], limit=1)
        if existing_device:
            values['device_id'] = existing_device.id
        request.env['iot.message'].sudo().create(values)
        return 'ok'

    @http.route('/iot2', type='http', auth='public', csrf=False)
    def check_device(self, iot_identifier, name, identifier):
        # Search id of iotbox that corresponds to this identifier
        existing_devices = request.env['iot.device'].sudo().search([('iot_id.identifier', '=', iot_identifier),
                                                               ('identifier', '=', identifier)])
        if not existing_devices:
            box = request.env['iot.box'].sudo().search([('identifier', '=', iot_identifier)], limit=1)
            request.env['iot.device'].sudo().create({
                'iot_id': box.id, #Might return error code when not successful
                'name': name,
                'identifier': identifier,
            })
        return 'ok'

    @http.route('/iot3', type='http', auth='public', csrf=False)
    def check_box(self, name, identifier):
        existing_box = request.env['iot.box'].sudo().search([('identifier', '=', identifier)])
        if not existing_box:
            request.env['iot.box'].sudo().create({
                'name': name,
                'identifier': identifier,
            })
        return 'ok'
