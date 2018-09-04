import evdev
from threading import Thread

#from ..controllers.driver import USBDriver

class Driver(Thread):
#    def __init__(self, path):
#        pass

    def supported(self):
        pass

    def value(self):
        pass

    def get_name(self):
        pass

    def get_connection(self):
        pass

    def action(self, action):
        pass

#----------------------------------------------------------
# Usb drivers
#----------------------------------------------------------
usbdrivers = []

class UsbMetaClass(type):
    def __new__(cls, clsname, bases, attrs):
        newclass = super(UsbMetaClass, cls).__new__(cls, clsname, bases, attrs)
        usbdrivers.append(newclass)
        return newclass


class USBDriver(Driver,metaclass=UsbMetaClass):
    def __init__(self, dev):
        super(USBDriver, self).__init__()
        self.dev = dev
        self.value = ""

    def get_name(self):
        lsusb = str(subprocess.check_output('lsusb')).split("\\n")
        for usbpath in lsusb:  # Should filter on usb devices or inverse loops?
            device = self.dev
            if "%04x:%04x" % (device.idVendor, device.idProduct) in usbpath:
                return usbpath.split("%04x:%04x" % (device.idVendor, device.idProduct))[1]
        return str(device.idVendor) + ":" + str(device.idProduct)

    def get_connection(self):
        return 'direct'

    def value(self):
        return self.value

class KeyboardUSBDriver(USBDriver):

    def supported(self):
        return getattr(self.dev, 'idVendor') == 0x046d and getattr(self.dev, 'idProduct') == 0xc31c

    def value(self):
        return self.value

    def run(self):
        devices = [evdev.InputDevice(path) for path in evdev.list_devices()]
        for device in devices:
            if ('Keyboard' in device.name) & ('input0' in device.phys):
                path = device.path

        device = evdev.InputDevice(path)

        for event in device.read_loop():
            if event.type == evdev.ecodes.EV_KEY:
                data = evdev.categorize(event)
                if data.scancode == 96:
                    return {}
                elif data.scancode == 28:
                    self.value = ''
                elif data.keystate:
                    self.value += data.keycode.replace('KEY_','')

    def action(self, action):
        pass