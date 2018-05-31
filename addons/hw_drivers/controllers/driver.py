#!/usr/bin/python3
import logging
import time
from threading import Thread
import usb
import serial
import gatt
from odoo import http


logging.basicConfig(level=logging.DEBUG, format='%(asctime)s %(levelname)s %(name)s: %(message)s')
_logger = logging.getLogger('dispatcher')


class StatusController(http.Controller):

    @http.route('/drivers/status', type='http', auth='none', cors='*')
    def status(self):
        result = "<html><head></head><body>List of drivers and values: <br/> <ul>"
        for path in drivers:
            result += "<li>" + path + ":" + str(drivers[path].value) + "</li>"
        result += "</ul></body></html>"
        return result

#----------------------------------------------------------
# Driver controller
#----------------------------------------------------------
#class ScaleDriver(hw_proxy.Proxy):
#    @http.route('/hw_drivers/list', type='json', auth='none', cors='*')
#    def value(self, path):
#        pass

#    @http.route('/hw_drivers/value/<path>', type='json', auth='none', cors='*')
#    def value(self, path):
#        pass

#    @http.route('/hw_drivers/action/path', type='json', auth='none', cors='*')
#    def scale_zero(self, path, action):
#        pass

#----------------------------------------------------------
# Driver common interface
#----------------------------------------------------------
class Driver(Thread):
    def __init__(self, path):
        pass

    def supported(self):
        pass

    def value(self):
        pass

    def run(self):
        pass

    def action(self, action):
        pass

#----------------------------------------------------------
# Usb drivers
#----------------------------------------------------------
usbdrivers = []
drivers = {}

class UsbMetaClass(type):
    def __new__(cls, clsname, bases, attrs):
        newclass = super(UsbMetaClass, cls).__new__(cls, clsname, bases, attrs)
        usbdrivers.append(newclass)
        return newclass


class USBDriver(Driver,metaclass=UsbMetaClass):
    pass


class SylvacUSBDriver(USBDriver):
    def __init__(self, dev):
        self.dev = dev
        self.value = ""

    def supported(self):
        return getattr(self.dev, 'idVendor') == 0x0403 and getattr(self.dev, 'idProduct') == 0x6001

    def value(self):
        return self.value

    def run(self):
        drivers[self.dev.idVendor] = self #Change by path
        connection = serial.Serial('/dev/serial/by-id/usb-Sylvac_Power_USB_A32DV5VM-if00-port0',
                                   baudrate=4800,
                                   bytesize=7,
                                   stopbits=2,
                                   parity=serial.PARITY_EVEN)
        measure = b''
        no_except = True
        while no_except:
            try:
                char = connection.read(1)
                if ord(char) == 13:
                    # Let's send measure
                    self.value = measure
                    print(self.value)
                    measure = b''
                else:
                    measure += char
            except:
                no_except = False

    def action(self, action):
        pass


btdrivers = []

class BtMetaClass(type):
    def __new__(cls, clsname, bases, attrs):
        newclass = super(BtMetaClass, cls).__new__(cls, clsname, bases, attrs)
        btdrivers.append(newclass)
        return newclass


class BtDriver(metaclass=BtMetaClass):
    def __init__(self, manager, device):
        self.manager = manager
        self.device = device #As for USB, we could put init values here? (or maybe this structure is too complicated)

    def supported(self):
        pass

    def value(self):
        pass

    def run(self):
        pass

    def action(self, action):
        pass


class SylvacBluetoothDriver(BtDriver, gatt.Device):

    def supported(self):
        return self.device.alias =="SY295"

    def value(self):
        return self.value


    def services_resolved(self):
        super().services_resolved()

        device_information_service = next(
            s for s in self.services
            if s.uuid == '00005000-0000-1000-8000-00805f9b34fb')

        measurement_characteristic = next(
            c for c in device_information_service.characteristics if c.uuid == '00005020-0000-1000-8000-00805f9b34fb')
        # m2 = next(c for c in device_information_service.characteristics if c.uuid == '00005021-0000-1000-8000-00805f9b34fb')
        # print m2.read_value()
        measurement_characteristic.enable_notifications()

    def characteristic_value_updated(self, characteristic, value):
        total = value[0] + value[1] * 256 + value[2] * 256 * 256 + value[3] * 256 * 256 * 256
        print('SY295', total / 1000000.0)

        # print "Supermeasurement ", characteristic, hex(value[0]), hex(value[1]), hex(value[2]), hex(value[3]), total

    def characteristic_enable_notification_succeeded(self):
        print("Success pied à coulisse Bluetooth!")

    def characteristic_enable_notification_failed(self):
        print("Problem connecting")

    def action(self, action):
        pass


#----------------------------------------------------------
# Bluetooth drivers
#----------------------------------------------------------

#----------------------------------------------------------
# DeviceManager
#----------------------------------------------------------
class DeviceManager(gatt.DeviceManager):
    devices = {}

    def main(self):
        while 1:
            devs = usb.core.find(find_all=True)
            updated_devices = {}
            for dev in devs:
                path =  "usb/%03d/%03d/%04x:%04x" % (dev.bus, dev.address, dev.idVendor, dev.idProduct)
                updated_devices[path] = self.devices.get(path, dev)
            added = updated_devices.keys() - self.devices.keys()
            removed = self.devices.keys() - updated_devices.keys()
            self.devices = updated_devices
            print('added %s removed %s'%(added, removed))
            print(len(self.devices))
            for path in added:
                for driverclass in usbdrivers:
                    _logger.info('For device %s checking driver %s', path, driverclass)
                    d = driverclass(updated_devices[path])
                    if d.supported():
                        _logger.info('For device %s will be driven', path)
                        # launch thread
                        d.run()
                    else:
                        del d
            time.sleep(3)


    def device_discovered(self, device):
        # TODO: need some kind of updated_devices mechanism
        print("Discovered")
        for driverclass in btdrivers:
            d = driverclass(self, device)
            if d.supported():
                d.run()
            else:
                del d
        #print("Discovered [%s] %s" % (device.mac_address, device.alias()))


class DM2(Thread):
    def run(self):
        dm.main()

#----------------------------------------------------------
# Agent ? Push values
#----------------------------------------------------------
# SDQFSQDFQSDF
dm = DeviceManager(adapter_name='hci0')
dm2 = DM2()
dm2.start()

#if __name__ == '__main__':
print (usbdrivers)

#dm.start_discovery() #bluetooth
#dm.run() #bluetooth
#dm.main()



"""
# -*- coding: utf-8 -*-S
try:
    import usb.core
    import usb.util
except ImportError:
    usb = None
from threading import Thread
from urllib import request, parse
import os
import serial
import gatt

from uuid import getnode as get_mac
mac = get_mac()
server = "http://localhost:8069/"

url = server + "iot3/"#/check_box"
values = {'name': "IoT-on-laptop", 'identifier': mac}

data = parse.urlencode(values).encode()
req =  request.Request(url, data=data)
response = request.urlopen(req)

buses = {}


def send_device(name, identifier):
    url = server + "iot2/"  # /check_device"
    values = {'iot_identifier': mac,
              'name': name,
              'identifier': identifier}
    data = parse.urlencode(values).encode()
    req = request.Request(url, data=data)
    response = request.urlopen(req)

def send_message(device_identifier, message):
    url = server + "iot1/"  # /post_device"
    values = {'iot_identifier': mac,
              'device_identifier': device_identifier,
              'message': message}
    data = parse.urlencode(values).encode()
    req = request.Request(url, data=data)
    response = request.urlopen(req)

class HwProxy(object):
    def get_status(self):
        status = {}
        for bus in buses:
            status[bus] = buses[bus].get_status()
        return status


class UsbProxy(Thread):

    def run(self):
        # Check different
        # Check all drivers
        devices = usb.core.find(find_all=True)
        for dev in devices:
            # Basic conf, endpoints, ...
            for fact in usb_driver_factories:
                # Need a check to see if the device has no been registered already?

                # Continue...
                result = usb_driver_factories[fact].try_to_match_device(dev)
                if result:
                    send_device(result[0], result[1])

usb_driver_factories = {}
buses['usb'] = UsbProxy()


class AbstractUsbDriverFactory(object):  # No abstract class defined in current pos?

    def try_to_match_device(self, dev):
        pass

    def run(self):
        pass


active_usb_devices = {}


class MouseUsbDriverFactory(AbstractUsbDriverFactory):

    def try_to_match_device(self, dev):
        super(MouseUsbDriverFactory, self).try_to_match_device(dev)
        match = False
        if dev.idVendor == 1133 and dev.idProduct == 49271:
            match = True

        if match:  # code below might be put in constructor somehow
            if not active_usb_devices.get(dev.bcdDevice):
                if dev.is_kernel_driver_active(0):
                    dev.detach_kernel_driver(0)
                dev.set_configuration()
                cfg = dev.get_active_configuration()
                intf = cfg[(0, 0)]
                is_IN = lambda e: usb.util.endpoint_direction(e.bEndpointAddress) == usb.util.ENDPOINT_IN
                ep = usb.util.find_descriptor(intf, custom_match=is_IN)
                active_usb_devices[dev.bcdDevice] = MouseUsbDriver(dev, ep)
                active_usb_devices[dev.bcdDevice].start()
                return ('Logitech USB Mouse', 'Mousy')  # No way to identify uniquely
        return False


usb_driver_factories['mouse'] = MouseUsbDriverFactory()


class MouseUsbDriver(Thread):

    def __init__(self, dev, in_point):
        super(MouseUsbDriver, self).__init__()
        self.in_point = in_point
        self.dev = dev

    def run(self):
        # Read something from the mouse
        while True:
            try:
                send_message('Mousy', self.dev.read(self.in_point.bEndpointAddress, self.in_point.wMaxPacketSize))
            except Exception as e:
                pass


class SerialProxy(Thread):
    def run(self):
        for fact in serial_driver_factories:
            result = serial_driver_factories[fact].try_to_match_device()
            if result:
                send_device(result[0], result[1])

serial_driver_factories = {}

buses['serial'] = SerialProxy()


class SylvacSerialDriverFactory():
    active_driver = False

    def try_to_match_device(self):
        try:
            files = os.listdir('/dev/serial/by-id')
        except:
            files = []
        if 'usb-Sylvac_Power_USB_A32DV5VM-if00-port0' in files:
            connection = serial.Serial('/dev/serial/by-id/usb-Sylvac_Power_USB_A32DV5VM-if00-port0',
                                       baudrate=4800,
                                       bytesize=7,
                                       stopbits=2,
                                       parity=serial.PARITY_EVEN)
            send_device('pied a coulisse', 'S_Calpro')
            self.active_driver = SylvacSerialDriver(connection)
            self.active_driver.start()
        #else:
        #    import pdb; pdb.set_trace()


serial_driver_factories['sylvac'] = SylvacSerialDriverFactory()

class SylvacSerialDriver(Thread):
    def __init__(self, connection):
        super(SylvacSerialDriver, self).__init__()
        self.connection = connection

    def run(self):
        measure = b''
        while True:
            char = self.connection.read(1)
            if ord(char) == 13:
                # Let's send measure
                send_message('S_Calpro', measure)
                measure = b''
            else:
                measure += char




HwProxy()
buses['usb'].start()
buses['serial'].start()
bluetooth_driver_factories = {}


class BluetoothProxy(gatt.DeviceManager):

    def device_discovered(self, device):
        for fact in bluetooth_driver_factories:
            bluetooth_driver_factories[fact].try_to_match_device(self, device.mac_address, device.alias())
        #print("Discovered [%s] %s" % (device.mac_address, device.alias()))


class SylvacBluetoothDriverFactory():
    active_driver = False

    def try_to_match_device(self, manager, mac, alias):
        if alias == 'SY295':
            if not self.active_driver:
                self.active_driver = mac
                send_device('SY295 pied à coulisse Bluetooth', mac)
                device = AnyDevice(mac_address=mac, manager=manager)
                device.connect()
                manager.run()

bluetooth_driver_factories['Sylvac'] = SylvacBluetoothDriverFactory()


class AnyDevice(gatt.Device):
    def services_resolved(self):
        super().services_resolved()

        device_information_service = next(
            s for s in self.services
            if s.uuid == '00005000-0000-1000-8000-00805f9b34fb')

        measurement_characteristic = next(
            c for c in device_information_service.characteristics if c.uuid == '00005020-0000-1000-8000-00805f9b34fb')
        # m2 = next(c for c in device_information_service.characteristics if c.uuid == '00005021-0000-1000-8000-00805f9b34fb')
        # print m2.read_value()
        measurement_characteristic.enable_notifications()

    def characteristic_value_updated(self, characteristic, value):
        total = value[0] + value[1] * 256 + value[2] * 256 * 256 + value[3] * 256 * 256 * 256
        send_message('SY295', total / 1000000.0)

        # print "Supermeasurement ", characteristic, hex(value[0]), hex(value[1]), hex(value[2]), hex(value[3]), total

    def characteristic_enable_notification_succeeded(self):
        print("Success pied à coulisse Bluetooth!")

    def characteristic_enable_notification_failed(self):
        print("Problem connecting")




try:
    manager = BluetoothProxy(adapter_name='hci0')
    buses['bluetooth'] = manager
    manager.start_discovery()
    manager.run()
    bluetooth_driver_factories['SY295'] = AnyDevice()
except:
    print("Please power on bluetooth")

"""
