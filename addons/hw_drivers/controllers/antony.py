#!/usr/bin/python3

from threading import Thread
import gatt
from . import manager, driver
import json
import urllib3
import logging
import importlib.util
import os
from . import driver, iot_config as _server
from odoo import modules
from . import manager, driver_network, driver_bluetooth, driver_usb
#!/usr/bin/python3
import logging
import time
from threading import Thread
import usb
import gatt
import subprocess
import netifaces as ni
import json
import re
from odoo import http
import urllib3
from odoo.http import request as httprequest
import datetime

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s %(levelname)s %(name)s: %(message)s')
_logger = logging.getLogger('dispatcher')

owner_dict = {}
last_ping = {}

_logger = logging.getLogger(__name__)


#----------------------------------------------------------
# Helper
#----------------------------------------------------------
def get_hostname(cls):
    return socket.gethostname()

def get_mac_address(cls):
    return netifaces.ifaddresses('eth0')[netifaces.AF_LINK][0]['addr']

def get_ip(cls):
    return netifaces.ifaddresses('eth0')[netifaces.AF_INET][0]['addr']

def get_ip_v6(cls):
    return netifaces.ifaddresses('eth0')[netifaces.AF_INET6][0]['addr']

def read_file_first_line(cls, filename):
    content = ""
    try:
        f = open('/home/pi/' + filename, 'r')
        content = f.readline().strip('\n')
        f.close()
    finally:
        return content

def get_odoo_server_url(cls):
    return cls.read_file_first_line('odoo-remote-server.conf')

def get_token(cls):
    return cls.read_file_first_line('token')

#----------------------------------------------------------
# Usb drivers
#----------------------------------------------------------

class MetaDriver(Thread):
    _type = False
    _connection_type = False
    _identifier = False
    _name = False
    _value = False

    _raw_data = False

    def __init__(self, identifier, connection_type, raw_data):
        self._identifier = identifier
        self._connection_type = connection_type
        self._raw_data = raw_data
        self.set_name()
        super(MetaDriver, self).__init__()

    def is_compatible(self, identifier, raw_data):
        return True


    def connect(self):
        self.daemon = True
        self.start()
        pass

    def disconnect(self):
        self.daemon = False
        self._stop()
        pass

    def get_connection_type(self):
        return self._connection_type

    def get_type(self):
        return self._type

    def set_name(self):
        self._name = self._identifier

    def get_name(self):
        return self._name

    def get_identifier(self):
        return self._identifier

    def get_value(self):
        return self._value

    def action(self, action, params):
        try:
            return getattr(self, action)(params)
        except AttributeError:
            raise

class BTDriver(driver.MetaDriver, gatt.Device):
    def set_name(self):
        self._name = self._raw_data.alias()

class NetworkManager(manager.MetaManager):
    _type = 'network'

    def scan(self):
        self._find_printers()

    def _find_printers(self):
        printers = subprocess.check_output("sudo lpinfo -lv", shell=True).decode('utf-8').split('Device')
        for printer in printers:
            printerTab = printer.split('\n')
            if printer and printerTab[4].split('=')[1] != ' ':
                device_connection = printerTab[1].split('= ')[1]

                model = ''
                for device_id in printerTab[4].split('= ')[1].split(';'):
                    if any(x in device_id for x in ['MDL', 'MODEL']):
                        model = device_id.split(':')[1]
                name = printerTab[2].split('= ')[1]
                serial = re.sub('[^a-zA-Z0-9 ]+', '', model).replace(' ', '_')
                identifier = ''

                device = {
                    'model': model,
                    'name': name,
                    'serial': serial,
                    'connection_type': device_connection,
                    'type': 'printer',
                }

                if device_connection == 'direct':
                    identifier = serial + '_' + _server.get_mac_address()
                elif device_connection == 'network' and 'socket' in printerTab[0]:
                    socketIP = printerTab[0].split('://')[1]
                    macprinter = subprocess.check_output("arp -a " + socketIP + " |awk NR==1'{print $4}'", shell=True).decode('utf-8').split('\n')[0]
                    identifier = macprinter  # macPRINTER

                    device['macprinter'] = macprinter

                elif device_connection == 'network' and 'dnssd' in printerTab[0]:
                    hostname_printer = subprocess.check_output("ippfind -n \"" + model + "\" | awk \'{split($0,a,\"/\"); print a[3]}\' | awk \'{split($0,b,\":\"); print b[1]}\'", shell=True).decode('utf-8').split('\n')[0]
                    if hostname_printer:
                        macprinter = subprocess.check_output("arp -a " + hostname_printer + " |awk NR==1'{print $4}'", shell=True).decode('utf-8').split('\n')[0]
                        identifier = macprinter  # macprinter
                        device['macprinter'] = macprinter
                        device['hostname'] = hostname_printer

                identifier = identifier.replace(':', '_')

                if identifier:
                    device['identifier'] = identifier
                    self._add_device(identifier, device)

class NetworkPrinterDriver(driver.MetaDriver):
    _type = 'printer'

    def __init__(self, identifier, connection_type, raw_data):
        super(NetworkPrinterDriver, self).__init__(identifier, connection_type, raw_data)
        self._model = raw_data.get('model')
        self._connection_type = raw_data.get('connection_type')

    def is_compatible(self, identifier, raw_data):
        return raw_data.get('type') == 'printer'

    def connect(self):
        self._install_driver()

    def _install_driver(self):
        cmd = "sudo lpadmin -p '" + self._name + "' -E -v '" + self._connection_type + "'"
        try:
            ppd = subprocess.check_output("sudo lpinfo -m |grep '" + self._model + "'", shell=True).decode('utf-8').split('\n')
            if len(ppd) > 2:
                subprocess.call(cmd, shell=True)
            else:
                subprocess.call(cmd + " -m '" + ppd[0].split(' ')[0] + "'", shell=True)
        except:
            # TODO: WTF ? It crashes so we just retry ???
            subprocess.call(cmd, shell=True)

    def print(self, data):
        with open('/tmp/toprinter', 'w') as file:
            file.write(data)
        subprocess.call("cat /tmp/toprinter | base64 -d | lp -d " + self.name, shell=True)

class CameraPrinterDriver(driver.MetaDriver):
    _type = 'camera'

    def is_compatible(self, identifier, raw_data):
        return raw_data.get('type') == 'camera'

    def connect(self):
        self._install_driver()

    def _install_driver(self):
        pass

class USBManager(manager.MetaManager):
    _type = 'usb'

    def scan(self):
        self._clear_devices()

        for path in evdev.list_devices():
            device = evdev.InputDevice(path)
            identifier = "usb_%04x:%04x_%s_" % (device.info.vendor, device.info.product, path)
            self._add_device(identifier, device)

        self.connect_all_devices()

    def _find_cameras(self):
        try:
            cameras = subprocess.check_output("v4l2-ctl --list-devices", shell=True).decode('utf-8').split('\n\n')
            for camera in cameras:
                if camera:
                    camera = camera.split('\n\t')
                    name = camera[0].split(' (')[0]

                    self._add_device(name, {
                        'name': name,
                        'serial': re.sub('[^a-zA-Z0-9 ]+', '', camera[0].split('): ')[0]).replace(' ', '_'),
                        'address': camera[1]
                    })
        except:
            pass

#----------------------------------------------------------
# Drivers
#----------------------------------------------------------
driverclasses = []

drivers = {}

class DriverMetaClass(type):
    def __new__(cls, clsname, bases, attrs):
        newclass = super(UsbMetaClass, cls).__new__(cls, clsname, bases, attrs)
        driverclasses.append(newclass)
        return newclass

class Driver(Thread, metaclass=DriverMetaClass):

    def __init__(self, dm,  dev):
        self.dm = dm
        self.dev = dev

    def supported(self):
        pass

    def setup(self):
        pass

    def ping(self):
        pass

    def read(self):
        pass

    def write(self, action):
        pass

class DeviceManager(Thread):
    devices = {}

    def trigger():
        pass

    def detect(self):
        devs = usb.core.find(find_all=True)

        connected_devices = {}
        for dev in devs:
            path =  "usb_%04x:%04x_%03d_%03d_" % (dev.idVendor, dev.idProduct, dev.bus, dev.address)
            connected_devices[path] = dev

        added = connected_devices.keys() - self.devices.keys()
        removed = self.devices.keys() - connected_devices.keys()

        self.devices = connected_devices
        for path in removed:
            del drivers[path]

        for path in added:
            for driverclass in driverclasses:
                if issubclass(driverclass, USBDriver):
                    d = driverclass(self.devices[path])
                    if d.supported():
                        _logger.info('Device %s will be driven by %s', path, driverclass)
                        drivers[path] = d

#----------------------------------------------------------
# Usb drivers
#----------------------------------------------------------
class USBDriver(Driver):

    def __str__(self):
        return '%s:%s' % (self.dev.idVendor, self.dev.idProduct)

class SylvacUSBDriver(USBDriver):

    def supported(self):
        return self.dev.idVendor == 0x0403 and self.dev.idProduct == 0x6001

    def setup(self):
        # should be based on self.dev.idVendor and self.dev.idProduct
        self.conn = serial.Serial('/dev/serial/by-id/usb-Sylvac_Power_USB_A32DV5VM-if00-port0', baudrate=4800, bytesize=7, stopbits=2, parity=serial.PARITY_EVEN)

    def read(self, request_id):
        self.dm.send(self.conn.readline(timeout=3), request_id)

class KeyboardUSBDriver(USBDriver):
    # Pedales, claiver, barcode scanner

    def supported(self):
        return self.dev.bDeviceClass == 123

    def setup(self):
        # should be based on self.dev.idVendor and self.dev.idProduct
        # path be based on self.dev.Bus and self.dev.idProduct
        #"pci-0000:00:14.0-usb-0:1:1.0-mouse" % self.dev.bus self.dev.device Bus 001 Device 034
        # on s'en fou only one per device
        self.conn = serial.Serial('/dev/input/by-path/', baudrate=4800, bytesize=7, stopbits=2, parity=serial.PARITY_EVEN)

    def action(self, request_id, body):
        Thread
            self.dm.send(requesrt)


    def run(self):
        while 1:
            # blcoking
            data = self.dev.read(endpoint_in, len(msg),100)
            self.dm.send(data)
            self.dm.send(self.conn.readline(timeout=3), None)

class USBCamDriver(USBDriver):

    def supported(self):
        return self.dev.bDeviceClass == 123

    def setup(self):
        pass

    def read(self):
        self.event.trigger()
        # should be based on self.dev.idVendor and self.dev.idProduct
        #self.conn = serial.Serial('/dev/serial/by-id/usb-Sylvac_Power_USB_A32DV5VM-if00-port0', baudrate=4800, bytesize=7, stopbits=2, parity=serial.PARITY_EVEN)
        #picture = subprocess.check_output("v4l2-ctl --list-formats-ext|grep 'Size'|awk '{print $3}'|sort -rn|awk NR==1", shell=True).decode('utf-8')
        #subprocess.call("fswebcam -d " + self._address + " /tmp/testimage -r " + picture, shell=True)
        #return subprocess.check_output('cat /tmp/testimage | base64', shell=True)
        return self.conn.readline(timeout=3)

    def run(self):
        while event.wait()):
            # should be based on self.dev.idVendor and self.dev.idProduct
            #self.conn = serial.Serial('/dev/serial/by-id/usb-Sylvac_Power_USB_A32DV5VM-if00-port0', baudrate=4800, bytesize=7, stopbits=2, parity=serial.PARITY_EVEN)
            #picture = subprocess.check_output("v4l2-ctl --list-formats-ext|grep 'Size'|awk '{print $3}'|sort -rn|awk NR==1", shell=True).decode('utf-8')
            #subprocess.call("fswebcam -d " + self._address + " /tmp/testimage -r " + picture, shell=True)
            #return subprocess.check_output('cat /tmp/testimage | base64', shell=True)
            return self.conn.readline(timeout=3)

#----------------------------------------------------------
# Bluetooth drivers
#----------------------------------------------------------
class BtDriver(Driver, metaclass=BtMetaClass):

    def disconnect(self):
        path = "bt_%s" % (self.dev.mac_address,)
        del drivers[path]

    def get_name(self):
        return self.dev.alias()

    def read(self):
        return self.value

    def write(self, action):
        pass

class GattBtManager(gatt.DeviceManager):

    def device_discovered(self, device):
        # TODO: need some kind of updated_devices mechanism or not?
        path = "bt_%s" % (device.mac_address,)
        if path not in drivers:
            for driverclass in btdrivers:
                d = driverclass(device)
                if d.supported():
                    drivers[path] = d
                    d.setup()

class BtManager(Thread):

    def run(self):
        dm = GattBtManager(adapter_name='hci0')
        dm.start_discovery()
        dm.run()

#----------------------------------------------------------
# Cups
#----------------------------------------------------------

#----------------------------------------------------------
# Device Manager
#----------------------------------------------------------



#----------------------------------------------------------
# ITO box?
#----------------------------------------------------------

def send_iot_box_device(send_printer):
    maciotbox = subprocess.check_output("/sbin/ifconfig eth0 |grep -Eo ..\(\:..\){5}", shell=True).decode('utf-8').split('\n')[0]
    server = "" # read from file
    try:
        f = open('/home/pi/odoo-remote-server.conf', 'r')
        for line in f:
            server += line
        f.close()
    except: #In case the file does not exist
        server=''
    server = server.split('\n')[0]
    if server:
        url = server + "/iot/setup"
        interfaces = ni.interfaces()
        for iface_id in interfaces:
            iface_obj = ni.ifaddresses(iface_id)
            ifconfigs = iface_obj.get(ni.AF_INET, [])
            for conf in ifconfigs:
                if conf.get('addr') and conf.get('addr') != '127.0.0.1':
                    ips = conf.get('addr')
                    break

        # Build device JSON
        devicesList = {}
        for path in drivers:
            device_name = drivers[path].get_name()
            device_connection = drivers[path].get_connection()
            identifier = path.split('_')[0] + '_' + path.split('_')[1]
            devicesList[identifier] = {'name': device_name,
                                 'type': 'device',
                                 'connection': device_connection}

        # Build camera JSON
        try:
            cameras = subprocess.check_output("v4l2-ctl --list-devices", shell=True).decode('utf-8').split('\n\n')
            for camera in cameras:
                if camera:
                    camera = camera.split('\n\t')
                    serial = re.sub('[^a-zA-Z0-9 ]+', '', camera[0].split('): ')[0]).replace(' ','_')
                    devicesList[serial] = {
                                            'name': camera[0].split(' (')[0],
                                            'connection': 'direct',
                                            'type': 'camera'
                                        }
        except:
            pass

        # Build printer JSON
        printerList = {}
        if send_printer:
            printers = subprocess.check_output("sudo lpinfo -lv", shell=True).decode('utf-8').split('Device')
            for printer in printers:
                printerTab = printer.split('\n')
                if printer and printerTab[4].split('=')[1] != ' ':
                    device_connection = printerTab[1].split('= ')[1]
                    model = ''
                    for device_id in printerTab[4].split('= ')[1].split(';'):
                        if any(x in device_id for x in ['MDL','MODEL']):
                            model = device_id.split(':')[1]
                    name = printerTab[2].split('= ')[1]
                    serial = re.sub('[^a-zA-Z0-9 ]+', '', model).replace(' ','_')
                    identifier = ''
                    if device_connection == 'direct':
                        identifier = serial + '_' + maciotbox  #name + macIOTBOX
                    elif device_connection == 'network' and 'socket' in printerTab[0]:
                        socketIP = printerTab[0].split('://')[1]
                        macprinter = subprocess.check_output("arp -a " + socketIP + " |awk NR==1'{print $4}'", shell=True).decode('utf-8').split('\n')[0]
                        identifier = macprinter  # macPRINTER
                    elif device_connection == 'network' and 'dnssd' in printerTab[0]:
                        hostname_printer = subprocess.check_output("ippfind -n \"" + model + "\" | awk \'{split($0,a,\"/\"); print a[3]}\' | awk \'{split($0,b,\":\"); print b[1]}\'", shell=True).decode('utf-8').split('\n')[0]
                        if hostname_printer:
                            macprinter = subprocess.check_output("arp -a " + hostname_printer + " |awk NR==1'{print $4}'", shell=True).decode('utf-8').split('\n')[0]
                            identifier = macprinter  # macprinter

                    identifier = identifier.replace(':','_')
                    if identifier and identifier not in printerList:
                        printerList[identifier] = {
                                            'name': model,
                                            'connection': device_connection,
                                            'type': 'printer'
                        }

                        # install these printers
                        try:
                            ppd = subprocess.check_output("sudo lpinfo -m |grep '" + model + "'", shell=True).decode('utf-8').split('\n')
                            if len(ppd) > 2:
                                subprocess.call("sudo lpadmin -p '" + identifier + "' -E -v '" + printerTab[0].split('= ')[1] + "'", shell=True)
                            else:
                                subprocess.call("sudo lpadmin -p '" + identifier + "' -E -v '" + printerTab[0].split('= ')[1] + "' -m '" + ppd[0].split(' ')[0] + "'", shell=True)
                        except:
                            subprocess.call("sudo lpadmin -p '" + identifier + "' -E -v '" + printerTab[0].split('= ')[1] + "'", shell=True)
            subprocess.call('> /tmp/printers', shell=True)
            for printer in printerList:
                subprocess.call('echo "' + printerList[printer]['name'] + '" >> /tmp/printers', shell=True)

        if devicesList:
            subprocess.call('> /tmp/devices', shell=True)
            for device in devicesList:
                subprocess.call('echo "' + str(device) + '|' + devicesList[device]['name'] + '" >> /tmp/devices', shell=True)

        #build JSON with all devices
        hostname = subprocess.check_output('hostname').decode('utf-8').split('\n')[0]
        token = "" # read from file
        try:
            f = open('/home/pi/token', 'r')
            for line in f:
                token += line
            f.close()
        except: #In case the file does not exist
            token=''
        token = token.split('\n')[0]
        data = {'name': hostname,'identifier': maciotbox, 'ip': ips, 'token': token}
        devicesList.update(printerList)
        data['devices'] = devicesList
        data_json = json.dumps(data).encode('utf8')
        headers = {'Content-type': 'application/json', 'Accept': 'text/plain'}
        http = urllib3.PoolManager()
        req = False
        try:
            req = http.request('POST',
                                url,
                                body=data_json,
                                headers=headers)
        except:
            _logger.warning('Could not reach configured server')

queue = [{''}]
queue_event = Event

class StatusController(http.Controller):

    @http.route('/hw_drivers/owner/check', type='json', auth='none', cors='*', csrf=False)
    def check_cantakeowner(self): #, devices, tab
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
    def take_ownership(self): #, devices, tab
        data = httprequest.jsonrequest
        for device in data['devices']:
            owner_dict[device] = data['tab']
            last_ping[data['tab']] = datetime.datetime.now()
        return data['tab']

    @http.route('/hw_drivers/owner/ping', type='json', auth='none', cors='*', csrf=False)
    def ping_trigger(self): #, tab
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
            send_iot_box_device(False)
            return 'IoTBox connected'

    @http.route('/hw_drivers/drivers/status', type='http', auth='none', cors='*')
    def status(self):
        result = "<html><head></head><body>List of drivers and values: <br/> <ul>"
        for path in drivers:
            result += "<li>" + path + ":" + str(drivers[path].value) + "</li>"
        result += "</ul>"
        result +=" </body></html>"
        return result

    @http.route('/hw_drivers/driverdetails/<string:identifier>', type='http', auth='none', cors='*')
    def statusdetail(self, identifier):
        for device in drivers:
            if device.find(identifier) != -1:
                return str(drivers[device].value)
        return ''

    @http.route('/hw_drivers/driveraction/<string:identifier>', type='json', auth='none', cors='*', csrf=False)
    def driveraction(self, identifier):
        data = httprequest.jsonrequest
        result = 'device not found'
        if data.get('action') == 'print':
            with open('/tmp/toprinter', 'w') as file:
                file.write(data['data'])
            subprocess.call("cat /tmp/toprinter | base64 -d | lp -d " + identifier, shell=True)
            result = 'ok'
        if data.get('action') == 'camera':
            cameras = subprocess.check_output("v4l2-ctl --list-devices", shell=True).decode('utf-8').split('\n\n')
            adrress = '/dev/video0'
            for camera in cameras:
                if camera:
                    camera = camera.split('\n\t')
                    serial = re.sub('[^a-zA-Z0-9 ]+', '', camera[0].split('): ')[0]).replace(' ','_')
                    if serial == data.get('identifier'):
                        adrress = camera[1]
            picture = subprocess.check_output("v4l2-ctl --list-formats-ext|grep 'Size'|awk '{print $3}'|sort -rn|awk NR==1", shell=True).decode('utf-8')
            subprocess.call("fswebcam -d " + adrress + " /tmp/testimage -r " + picture, shell=True)
            image_bytes = subprocess.check_output('cat /tmp/testimage | base64',shell=True)
            result = {'image': image_bytes}
        return result


    @http.route('/hw_drivers/discover', type='http', auth='none', cors='*')

    @http.route('/hw_drivers/write', type='http', auth='none', cors='*')
    def send_iot_box(self, device, request_id, message):
        Driver[device].action(request_id, message={})
        return request_id

    @http.route('/hw_drivers/event', type='http', auth='none', cors='*')
    def send_iot_box(self):
        send_iot_box_device(False)
        wait event:
            return queue
        return 'ok'

