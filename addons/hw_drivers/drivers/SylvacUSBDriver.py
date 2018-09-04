
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



class SylvacUSBDriver(USBDriver):

    def supported(self):
        return getattr(self.dev, 'idVendor') == 0x0403 and getattr(self.dev, 'idProduct') == 0x6001

    def run(self):
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
                    self.value = measure.decode("utf-8")
                    measure = b''
                else:
                    measure += char
            except:
                no_except = False

    def action(self, action):
        pass