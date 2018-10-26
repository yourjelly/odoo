#!/usr/bin/python3

from odoo import http
from odoo.http import request as httprequest

import datetime
import subprocess

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
        server = ""  # read from file
        try:
            f = open('/home/pi/odoo-remote-server.conf', 'r')
            for line in f:
                server += line
            f.close()
            server = server.split('\n')[0]
        except:
            server = ''
        if server:
            return 'This IoTBox has already been connected'
        else:
            iotname = ''
            token = data['token'].split('|')[1]
            url = data['token'].split('|')[0]
            reboot = 'noreboot'
            subprocess.call(['/home/pi/odoo/addons/point_of_sale/tools/posbox/configuration/connect_to_server.sh', url, iotname, token, reboot])
            send_iot_box_device()
            return 'IoTBox connected'

    @http.route('/hw_drivers/drivers/status', type='http', auth='none', cors='*')
    def status(self):
        # TODO : WTF is this shit ?

        result = "<html><head></head><body>List of drivers and values: <br/> <ul>"
        for path in drivers:
            result += "<li>" + path + ":" + str(drivers[path].value) + "</li>"
        result += "</ul>"
        result += " </body></html>"
        return result

    @http.route('/hw_drivers/scan', type='json', auth='none', cors='*')
    def statusdetail(self, identifier):
        # TODO : MainManager.scan()

        return ''

    @http.route('/hw_drivers/device/value/<string:identifier>', type='json', auth='none', cors='*')
    def statusdetail(self, identifier):
        # TODO : MainManager.get_device(identifier).get_value()
        return ''

    @http.route('/hw_drivers/device/connect/<string:identifier>', type='json', auth='none', cors='*')
    def statusdetail(self, identifier):
        # TODO : MainManager.get_device(identifier).connect()
        return ''

    @http.route('/hw_drivers/device/disconnect/<string:identifier>', type='json', auth='none', cors='*')
    def statusdetail(self, identifier):
        # TODO : MainManager.get_device(identifier).disconnect()
        return ''

    @http.route('/hw_drivers/device/action/<string:identifier>', type='json', auth='none', cors='*', csrf=False)
    def driveraction(self, identifier):
        # TODO : MainManager.get_device(identifier).action(action, data)
        return {
            'success': True,
            'message': '',
            'data': ''
        }


def send_iot_box_device():
    pass
