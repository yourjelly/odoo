# -*- coding: utf-8 -*-
import logging
#import os
#import re
#import time
#from collections import namedtuple
#from os import listdir
#from threading import Thread, Lock
from odoo import http
from odoo.http import request

class IoTController(http.Controller):

    @http.route('/get_url/<string:identifier>', type='http', auth='public')
    def get_url(self, identifier):
        iotbox = request.env['iot.box'].sudo().search([('identifier', '=', identifier)], limit=1)
        if iotbox.url:
            return iotbox.url
        else:
            return 'http://localhost:8069/point_of_sale/display' # ne trouve rien

    @http.route('/iotbox_conf', type='json', auth='public')
    def update_box(self):
        data = request.jsonrequest
        if 'iotbox' in data.keys():
            existing_box = request.env['iot.box'].sudo().search([('identifier', '=', data['iotbox']['identifier'])])
            if not existing_box:
                request.env['iot.box'].sudo().create({
                    'name': data['iotbox']['name'],
                    'identifier': data['iotbox']['identifier'],
                    'ip': data['iotbox']['ip'],
                })
            else:
                existing_box[0].ip = data['iotbox']['ip']
                existing_box[0].name = data['iotbox']['name']
            if 'devices' in data.keys():
                for device in data['devices'].keys():
                    existing_devices = request.env['iot.device'].sudo().search([('iot_id.identifier', '=', data['iotbox']['identifier']),
                        ('identifier', '=', device)])
                    if not existing_devices:
                        box = request.env['iot.box'].sudo().search([('identifier', '=', data['iotbox']['identifier'])], limit=1)
                        request.env['iot.device'].sudo().create({
                            'iot_id': box.id, #Might return error code when not successful
                            'name': data['devices'][device]['name'],
                            'identifier': device,
                            'device_type': data['devices'][device]['device_type'],
                            'device_connection': data['devices'][device]['device_connection'],
                        })

            if 'printers' in data.keys():
                for printer in data['printers'].keys():
                    existing_printers = request.env['iot.device'].sudo().search([('identifier', '=', printer)])
                    if not existing_printers:
                        box = request.env['iot.box'].sudo().search([('identifier', '=', data['iotbox']['identifier'])], limit=1)
                        request.env['iot.device'].sudo().create({
                            'iot_id': box.id, #Might return error code when not successful
                            'name': data['printers'][printer]['name'],
                            'identifier': printer,
                            'device_type': 'printer',
                            'device_connection': data['printers'][printer]['device_connection'],
                        })
                    else:
                        existing_printers[0].name = data['printers'][printer]['name']
        return 'ok'
