import evdev
from addons.hw_drivers.controllers.driver import USBDriver

class BarcodeScannerdUSBDriver(USBDriver):

    def supported(self):
        return getattr(self.dev, 'idVendor') == 0x0c2e and getattr(self.dev, 'idProduct') == 0x0204

    def value(self):
        return self.value

    def run(self):
        devices = [evdev.InputDevice(path) for path in evdev.list_devices()]
        for device in devices:
            if ('Scanner' in device.name) & ('input0' in device.phys):
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