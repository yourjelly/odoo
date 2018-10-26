#!/usr/bin/python3

import gatt

from . import manager, driver


class BTManager(manager.MetaManager, gatt.DeviceManager):
    _type = 'bluetooth'

    def __init__(self):
        super(BTManager, self).__init__(adapter_name='hci0')

    def scan(self):
        self.start_discovery()
        self.run()

    def device_discovered(self, device):
        identifier = "bt_%s" % (device.mac_address)
        self._add_device(identifier, device, mac_address=device.mac_address, manager=self)

    def _get_driver(self, device_name, raw_data):
        return BTDriver

class BTDriver(driver.MetaDriver, gatt.Device):
    def set_name(self):
        self._name = self._raw_data.alias()
