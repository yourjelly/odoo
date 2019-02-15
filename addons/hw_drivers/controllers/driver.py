#!/usr/bin/python3
import logging
import time
from threading import Thread, Event
from usb import core
from gatt import DeviceManager as Gatt_DeviceManager
import subprocess
import netifaces
import json
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
    path = os.path.join(os.getenv('HOME'), filename)
    if os.path.isfile(path):
        with open(path, 'r') as f:
            return f.readline().strip('\n')
    return ''

def get_odoo_server_url():
    return read_file_first_line('odoo-remote-server.conf')

def get_token():
    return read_file_first_line('token')

#----------------------------------------------------------
# Controllers
#----------------------------------------------------------

class StatusController(http.Controller):
    @http.route('/hw_drivers/action', type='json', auth='none', cors='*', csrf=False)
    def action(self, session_id, device_id, data):
        iot_device = iot_devices.get(device_id)
        if iot_device:
            iot_device.action(session_id, data)
            return True
        return False

    @http.route('/hw_drivers/event', type='json', auth='none', cors='*', csrf=False)
    def event(self, listener):
        """
        listener is a dict in witch there are a sessions_id and a dict of device_id to listen
        """
        req = DeviceManager.add_request(listener)
        if req['event'].wait(58):
            req['event'].clear()
            req['queue']['session_id'] = req['session_id']
            return req['queue']

    @http.route('/hw_drivers/box/connect', type='json', auth='none', cors='*', csrf=False)
    def connect_box(self, token):
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
            token = token.split('|')[1]
            url = token.split('|')[0]
            reboot = 'noreboot'
            subprocess.call(['/home/pi/odoo/addons/point_of_sale/tools/posbox/configuration/connect_to_server.sh', url, iotname, token, reboot])
            send_iot_box_device(False)
            return 'IoTBox connected'

#----------------------------------------------------------
# Drivers
#----------------------------------------------------------

drivers = []
bt_devices = {}
iot_devices = {}

class DriverMetaClass(type):
    def __new__(cls, clsname, bases, attrs):
        newclass = super(DriverMetaClass, cls).__new__(cls, clsname, bases, attrs)
        drivers.append(newclass)
        return newclass

class Driver(Thread, metaclass=DriverMetaClass):
    """
    Hook to register the driver into the drivers list
    """
    connection_type = ""

    def __init__(self, device):
        super(Driver, self).__init__()
        self.dev = device
        self.value = ""
        self.data = {}
        self.gatt_device = False

    @property
    def device_name(self):
        return self._device_name

    @property
    def device_identifier(self):
        return self._device_identifier

    @property
    def device_connection(self):
        """
        On specific driver override this method to give connection type of device
        return string
        possible value : direct - network - bluetooth
        """
        return self._device_connection

    @property
    def device_type(self):
        """
        On specific driver override this method to give type of device
        return string
        possible value : printer - camera - device
        """
        return self._device_type

    @classmethod
    def supported(cls, device):
        """
        On specific driver override this method to check if device is supported or not
        return True or False
        """
        pass

    def get_message(self):
        return ''

    def action(self, action):
        pass

    def disconnect(self):
        del iot_devices[self.device_identifier]


#----------------------------------------------------------
# Device manager
#----------------------------------------------------------

class DeviceManager(object):
    def __init__(self):
        self.sessions = {}

    def _delete_expired_sessions(self, max_time=70):
        '''
        Clears sessions that are no longer called.

        :param max_time: time a session can stay unused before being deleted
        '''
        now = time.time()
        expired_sessions = [session for session in self.sessions if now - self.sessions[session]['time_request'] > max_time]
        for session in expired_sessions:
            del self.sessions[session]

    def add_request(self, listener):
        self.session = {
            'session_id': listener['session_id'],
            'devices': [],
            'event': Event(),
            'queue': {},
            'time_request': time.time(),
        }
        self._delete_expired_sessions()
        for device in listener['devices']:
            self.session['devices'].append(device)
        self.sessions[listener['session_id']] = self.session
        return self.sessions[listener['session_id']]

    def device_changed(self, device):
        for session in self.sessions:
            if device.device_identifier in self.sessions[session]['devices']:
                self.sessions[session]['queue'] = device.data
                self.sessions[session]['queue']['device_id'] = device.device_identifier
                self.sessions[session]['queue']['value'] = device.value
                self.sessions[session]['event'].set()

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
                identifier = iot_devices[device].device_identifier
                devices_list[identifier] = {
                    'name': iot_devices[device].device_name,
                    'type': iot_devices[device].device_type,
                    'connection': iot_devices[device].device_connection,
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
                    body = json.dumps(data).encode('utf8'),
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
                    if driverclass.supported(device = updated_devices[path].dev):
                        _logger.info('For device %s will be driven', path)
                        d = driverclass(device = updated_devices[path].dev)
                        d.daemon = True
                        d.start()
                        iot_devices[path] = d
                        self.send_alldevices()
                        break
            time.sleep(3)

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
        gatt_manager = dm
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
