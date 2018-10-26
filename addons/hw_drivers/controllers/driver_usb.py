#!/usr/bin/python3

import usb
import subprocess
import re

from . import manager, driver


class USBManager(manager.MetaManager):
    _type = 'usb'

    def start(self):
        self.scan()

    def scan(self):
        self._clear_devices()

        # self._find_cameras()

        devices = usb.core.find(find_all=True)
        for device in devices:
            identifier = "usb_%04x:%04x_%03d_%03d_" % (device.idVendor, device.idProduct, device.bus, device.address)
            self._add_device(identifier, device)

        self.connect_all_devices()

    def _get_driver(self, device_name, raw_data):
        return USBDriver

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


class USBDriver(driver.MetaDriver):
    _type = 'misc'

class USBCameraDriver(driver.MetaDriver):
    _type = 'camera'

    def __init__(self, identifier, connection_type, raw_data):
        super(USBCameraDriver, self).__init__(identifier, connection_type, raw_data)
        self._address = raw_data.get('address')

    def camera(self):
        picture = subprocess.check_output("v4l2-ctl --list-formats-ext|grep 'Size'|awk '{print $3}'|sort -rn|awk NR==1", shell=True).decode('utf-8')
        subprocess.call("fswebcam -d " + self._address + " /tmp/testimage -r " + picture, shell=True)
        return subprocess.check_output('cat /tmp/testimage | base64', shell=True)
