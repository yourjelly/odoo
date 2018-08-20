# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request

class IoTController(http.Controller):

    # Return home screen
    @http.route('/iot/box/<string:identifier>/screen_url', type='http', auth='public')
    def get_url(self, identifier):
        iotbox = request.env['iot.box'].sudo().search([('identifier', '=', identifier)], limit=1)
        if iotbox.screen_url:
            return iotbox.screen_url
        else:
            return 'http://localhost:8069/point_of_sale/display'

    @http.route('/iot/setup', type='json', auth='public')
    def update_box(self):
        data = request.jsonrequest

        # Update or create box
        box = request.env['iot.box'].sudo().search([('identifier', '=', data['identifier'])])
        if box:
            box = box[0]
            box.ip = data['iotbox']['ip']
            box.name = data['iotbox']['name']
        else:
            box = request.env['iot.box'].sudo().create({'name': box['name'], 'identifier': box['identifier'], 'ip': box['ip'], })

        # Update or create devices
        for data_device in data['devices']:
            device = request.env['iot.device'].sudo().search([('iot_id', '=', box.id), ('identifier', '=', data_device['identifier'])])
            if device:
                device.name = data_device['name']
            else:
                device = request.env['iot.device'].sudo().create({
                    'iot_id': box.id,
                    'name': data_device['name'],
                    'identifier': data_device['identifier'],
                    'type': data_device['type'],
                    'connection': data_device['connection'],
                })