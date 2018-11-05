#!/usr/bin/python3

import datetime
import subprocess

from odoo import http
from odoo.http import request as httprequest

from . import iot_config as _server
from . import manager

"""Initialize the main manager"""
DMM = manager.MainManager()
DMM.init()

owner_dict = {}
last_ping = {}
drivers = {}


class IoTDriversController(http.Controller):

    @http.route('/hw_drivers/owner/check', type='json', auth='none', cors='*', csrf=False)
    def check_cantakeowner(self):  # , devices, tab
        data = httprequest.jsonrequest
        for device in data['devices']:
            if owner_dict.get(device) and owner_dict[device] != data['tab']:
                before_date = datetime.datetime.now() - datetime.timedelta(seconds=10)
                if last_ping.get(owner_dict[device]) and last_ping.get(owner_dict[device]) > before_date:
                    return 'no'
                else:
                    old_tab = owner_dict[device]
                    for dev2 in owner_dict:
                        if owner_dict[dev2] == old_tab:
                            owner_dict[dev2] = ''
        return 'yes'

    @http.route('/hw_drivers/owner/take', type='json', auth='none', cors='*', csrf=False)
    def take_ownership(self):  # , devices, tab
        data = httprequest.jsonrequest
        for device in data['devices']:
            owner_dict[device] = data['tab']
            last_ping[data['tab']] = datetime.datetime.now()
        return data['tab']

    @http.route('/hw_drivers/owner/ping', type='json', auth='none', cors='*', csrf=False)
    def ping_trigger(self):  # , tab
        data = httprequest.jsonrequest
        ping_dict = {}
        last_ping[data['tab']] = datetime.datetime.now()
        for dev in data['devices']:
            if owner_dict.get(dev) and owner_dict[dev] == data['tab']:
                for driver_path in drivers:
                    if driver_path.find(dev) == 0 and drivers[driver_path].ping_value:
                        ping_dict[dev] = drivers[driver_path].ping_value
                        drivers[driver_path].ping_value = ''  # or set it to nothing
            else:
                ping_dict[dev] = 'STOP'
        return ping_dict

    @http.route('/hw_drivers/box/connect', type='json', auth='none', cors='*', csrf=False)
    def connect_box(self):
        data = httprequest.jsonrequest
        server = _server.get_odoo_server_url()
        if server:
            return {
                'success': False,
                'message': 'This IoTBox has already been connected',
                'data': {}
            }
        else:
            iotname = ''
            token = data['token'].split('|')[1]
            url = data['token'].split('|')[0]
            reboot = 'noreboot'
            subprocess.call(['/home/pi/odoo/addons/point_of_sale/tools/posbox/configuration/connect_to_server.sh', url, iotname, token, reboot])
            DMM.send_to_odoo_server()
            return {
                'success': True,
                'message': 'IoTBox connected',
                'data': {}
            }

    @http.route('/hw_drivers/scan', type='json', auth='none', cors='*')
    def scan(self):
        return {
            'success': True,
            'message': '',
            'data': DMM.scan()
        }

    @http.route('/hw_drivers/device/value/<string:identifier>', type='json', auth='none', cors='*')
    def device_value(self, identifier):
        return {
            'success': True,
            'message': '',
            'data': DMM.get_device(identifier).get_value()
        }

    @http.route('/hw_drivers/device/connect/<string:identifier>', type='json', auth='none', cors='*')
    def device_connect(self, identifier):
        return {
            'success': True,
            'message': '',
            'data': DMM.get_device(identifier).connect()
        }

    @http.route('/hw_drivers/device/disconnect/<string:identifier>', type='json', auth='none', cors='*')
    def device_disconnect(self, identifier):
        return {
            'success': True,
            'message': '',
            'data': DMM.get_device(identifier).disconnect()
        }

    @http.route('/hw_drivers/device/action/<string:identifier>', type='json', auth='none', cors='*', csrf=False)
    def driveraction(self, identifier):
        data = httprequest.jsonrequest
        action = data.get('action')
        params = data.get('data')
        return {
            'success': True,
            'message': '',
            'data': DMM.get_device(identifier).action(action, params)
        }
