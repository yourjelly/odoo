#!/usr/bin/python3
import logging
from time import sleep
from threading import Thread, Event
from usb import core
from gatt import DeviceManager as Gatt_DeviceManager
from subprocess import call as subprocess_call
import netifaces
from json import dumps as json_dumps
from re import sub
from odoo import http, _
import urllib3
from odoo.http import request as httprequest
import os
import socket
from importlib import util
import v4l2
from fcntl import ioctl
from cups import Connection as cups_connection
from glob import glob
from base64 import b64decode

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s %(levelname)s %(name)s: %(message)s')
_logger = logging.getLogger('dispatcher')


#----------------------------------------------------------
# Helper
#----------------------------------------------------------

def get_mac_address():
    try:
        return netifaces.ifaddresses('eth0')[netifaces.AF_LINK][0]['addr']
    except:
        return netifaces.ifaddresses('wlan0')[netifaces.AF_LINK][0]['addr']

def get_ip():
    try:
        return netifaces.ifaddresses('eth0')[netifaces.AF_INET][0]['addr']
    except:
        return netifaces.ifaddresses('wlan0')[netifaces.AF_INET][0]['addr']

def read_file_first_line(filename):
    content = ""
    try:
        path = os.getenv("HOME") + '/' + filename
        f = open(path, 'r')
        content = f.readline().strip('\n')
        f.close()
    finally:
        return content

def get_odoo_server_url():
    return read_file_first_line('odoo-remote-server.conf')

def get_token():
    return read_file_first_line('token')

#----------------------------------------------------------
# Controllers
#----------------------------------------------------------

class StatusController(http.Controller):
    @http.route('/hw_drivers/action', type='json', auth='none', cors='*', csrf=False)
    def action(self, device_id, data):
        if device_id in iot_devices:
            return iot_devices[device_id].action(data)
        else:
            return {'message': _('Device %s not found' % device_id)}

    @http.route('/hw_drivers/event', type='json', auth='none', cors='*', csrf=False)
    def event(self, requests):
        req = DeviceManager.addRequest(requests)
        if req['event'].wait(58):
            req['event'].clear()
            return_value = req['queue'].copy()
            return return_value

    @http.route('/hw_drivers/box/connect', type='http', auth='none', cors='*', csrf=False)
    def connect_box(self, token):
        server = get_odoo_server_url()
        if server:
            f = open('/var/www/False.jpg','rb')
            return f.read()
        else:
            iotname = ''
            token = b64decode(token).decode('utf-8')
            url = token.split('|')[0]
            token = token.split('|')[1]
            reboot = 'noreboot'
            path = os.getenv("HOME") + '/odoo/addons/point_of_sale/tools/posbox/configuration/connect_to_server.sh'
            subprocess_call([path, url, iotname, token, reboot])
            m.send_alldevices()
            f = open('/var/www/True.jpg','rb')
            return f.read()

#----------------------------------------------------------
# Drivers
#----------------------------------------------------------

drivers = []
bt_devices = {}
iot_devices = {}

class MetaClass(type):
    def __new__(cls, clsname, bases, attrs):
        newclass = super(MetaClass, cls).__new__(cls, clsname, bases, attrs)
        drivers.append(newclass)
        return newclass

class Driver(Thread, metaclass=MetaClass):
    connection_type = ""

    def __init__(self, device, manager):
        super(Driver, self).__init__()
        self.dev = device
        self.manager = manager
        self.value = ""
        self.data = {}
        self.gatt_device = False

    def get_name(self):
        return ''

    def get_identifier(self):
        return ''

    def get_connection(self):
        return ''

    def get_message(self):
        return ''

    def get_type(self):
        return ''

    def supported(self):
        pass

    def action(self, action):
        pass

    def disconnect(self):
        del iot_devices[self.get_identifier()]


#----------------------------------------------------------
# Device manager
#----------------------------------------------------------

class DeviceManager():
    sessions = []

    def addRequest(self, requests):
        session = {
            'requests': requests,
            'event': Event(),
            'queue': [],
        }
        self.sessions.append(session)
        return session

    def deviceChanged(self, device):
        for session in self.sessions:
            for req in session['requests']:
                if device.get_identifier() == req.get('device_id'):
                    session['queue'].append({
                        'request_id': req.get('request_id'),
                        'value': device.value,
                        'data': device.data,
                    })
                    session['event'].set()

class IoTDevice(object):

    def __init__(self, dev, connection_type):
        self.dev = dev
        self.connection_type = connection_type

DeviceManager = DeviceManager()


#----------------------------------------------------------
# Manager
#----------------------------------------------------------

class Manager(Thread):

    def __init__(self):
        super(Manager, self).__init__()
        self.load_drivers()

    def load_drivers(self): # Load drivers from IoT Box
        path = os.getenv("HOME") + '/odoo/addons/hw_drivers/drivers'
        driversList = os.listdir(path)
        for driver in driversList:
            path_file = path + '/' + driver
            spec = util.spec_from_file_location(driver, path_file)
            if spec:
                foo = util.module_from_spec(spec)
                spec.loader.exec_module(foo)

    def send_alldevices(self): # Send device to Odoo
        server = get_odoo_server_url()
        if server:
            iot_box = {'name': socket.gethostname(),'identifier': get_mac_address(), 'ip': get_ip(), 'token': get_token()}
            devices_list = {}
            for device in iot_devices:
                identifier = iot_devices[device].get_identifier()
                devices_list[identifier] = {
                    'name': iot_devices[device].get_name(),
                    'type': iot_devices[device].get_type(),
                    'connection': iot_devices[device].get_connection(),
                }
            data = {
                'params': {
                    'iot_box' : iot_box,
                    'devices' : devices_list,
                }
            }
            urllib3.disable_warnings()
            http = urllib3.PoolManager(cert_reqs='CERT_NONE')
            try:
                req = http.request(
                    'POST',
                    server + "/iot/setup",
                    body = json_dumps(data).encode('utf8'),
                    headers = {'Content-type': 'application/json', 'Accept': 'text/plain'}
                )
            except:
                _logger.warning('Could not reach configured server')
        else:
            _logger.warning('Odoo server not set')

    def usb_loop(self):
        usb_devices = {}
        devs = core.find(find_all=True)
        for dev in devs:
            path =  "usb_%04x:%04x_%03d_%03d_" % (dev.idVendor, dev.idProduct, dev.bus, dev.address)
            iot_device = IoTDevice(dev, 'usb')
            usb_devices[path] = iot_device
        return usb_devices

    def video_loop(self):
        camera_devices = {}
        videos = glob('/dev/video*')
        for video in videos:
            vd = open(video, 'w')
            cp = v4l2.v4l2_capability()
            ioctl(vd, v4l2.VIDIOC_QUERYCAP, cp)
            cp.interface = video
            iot_device = IoTDevice(cp, 'video')
            camera_devices[cp.bus_info.decode('utf-8')] = iot_device
        return camera_devices

    def printer_loop(self):
        printer_devices = {}
        devices = conn.getDevices()
        for path in [printer_lo for printer_lo in devices if devices[printer_lo]['device-id']]:
            if 'uuid=' in path:
                serial = sub('[^a-zA-Z0-9 ]+', '', path.split('uuid=')[1])
            elif 'serial=' in path:
                serial = sub('[^a-zA-Z0-9 ]+', '', path.split('serial=')[1])
            else:
                serial = sub('[^a-zA-Z0-9 ]+', '', path)
            devices[path]['identifier'] = serial
            devices[path]['url'] = path
            iot_device = IoTDevice(devices[path], 'printer')
            printer_devices[serial] = iot_device
        return printer_devices

    def run(self):
        devices = {}
        updated_devices = {}
        self.send_alldevices()
        while 1:
            updated_devices = self.usb_loop()
            updated_devices.update(self.video_loop())
            updated_devices.update(self.printer_loop())
            updated_devices.update(bt_devices)
            added = updated_devices.keys() - devices.keys()
            removed = devices.keys() - updated_devices.keys()
            devices = updated_devices
            for path in [device_rm for device_rm in removed if device_rm in iot_devices]:
                iot_devices[path].disconnect()
            for path in [device_add for device_add in added if device_add not in iot_devices]:
                for driverclass in [d for d in drivers if d.connection_type == devices[path].connection_type]:
                    d = driverclass(device = updated_devices[path].dev, manager=self)
                    if d.supported():
                            _logger.info('For device %s will be driven', path)
                            iot_devices[path] = d
                            self.send_alldevices()
            sleep(3)

class GattBtManager(Gatt_DeviceManager):

    def device_discovered(self, device):
        path = "bt_%s" % (device.mac_address,)
        if path not in bt_devices:
            device.manager = self
            iot_device = IoTDevice(device, 'bluetooth')
            bt_devices[path] = iot_device

class BtManager(Thread):
    gatt_manager = False

    def run(self):
        dm = GattBtManager(adapter_name='hci0')
        self.gatt_manager = dm
        for device in [device_con for device_con in dm.devices() if device_con.is_connected()]:
            device.disconnect()
        dm.start_discovery()
        dm.run()

conn = cups_connection()
PPDs = conn.getPPDs()
printers = conn.getPrinters()

m = Manager()
m.daemon = True
m.start()

bm = BtManager()
bm.daemon = True
bm.start()
