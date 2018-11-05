#!/usr/bin/python3

import json
import urllib3
import logging
import importlib.util
import os
from threading import Thread

from . import iot_config as _server
from . import driver
from . import driver_network
from . import driver_bluetooth
from . import driver_usb

_logger = logging.getLogger(__name__)


class MainManager(Thread):
    _managers = {}

    def init(self):
        self.import_managers()
        self.import_drivers()

        for type, manager in self._managers.items():
            manager.init()

    def import_managers(self):
        self.add_manager(driver_network.NetworkManager)
        self.add_manager(driver_bluetooth.BTManager)
        self.add_manager(driver_usb.USBManager)

    def import_drivers(self):
        driversList = os.listdir("/home/pi/odoo/addons/hw_drivers/drivers")
        for driver in driversList:
            path = "/home/pi/odoo/addons/hw_drivers/drivers/" + driver
            spec = importlib.util.spec_from_file_location(driver, path)
            if spec:
                foo = importlib.util.module_from_spec(spec)
                print(spec)
                print(foo)
                spec.loader.exec_module(foo)

    def scan(self):
        for type, manager in self._managers.items():
            manager.scan()

    def add_manager(self, manager_class):
        manager = manager_class()
        type = manager.get_type()
        self._managers[type] = manager
        return manager

    def get_manager(self, type):
        return self._managers.get(type)

    def add_driver(self, type, driverClass):
        manager = self.get_manager(type)
        if manager:
            manager.add_driver(driverClass)

    def get_device(self, identifier, type=False):
        device = False
        if type:
            manager = self.get_manager(type)
            if manager:
                device = manager.get_device(identifier)
        else:
            for type, manager in self._managers.items():
                for key in manager.devices:
                    if key == identifier:
                        device = manager.devices.get(identifier)
                        break
        if not device:
            device = driver.DeviceNotFound(type)

        return device

    def get_devices_list(self):
        devices = {}
        for type, manager in self._managers.items():
            devices.update(manager.devices)

        return devices

    def send_to_odoo_server(self):
        server = _server.get_odoo_server_url()
        if server:
            url = server + "/iot/setup"

            data = {
                'name': _server.get_hostname(),
                'identifier': _server.get_mac_address(),
                'ip': _server.get_ip(),
                'token': _server.get_token(),
                'devices': self.get_devices_list(),
            }

            http = urllib3.PoolManager()
            try:
                http.request(
                    'POST',
                    url,
                    body=json.dumps(data).encode('utf8'),
                    headers={'Content-type': 'application/json', 'Accept': 'text/plain'}
                )
            except:
                _logger.warning('Could not reach configured server')
        else:
            _logger.warning('Odoo server not set')


class MetaManager:
    _type = False
    _devices = {}
    _drivers = []

    def init(self):
        pass

    def scan(self):
        pass

    def _clear_devices(self):
        self._devices = {}

    def _add_driver(self, driver):
        self._drivers.append(driver)

    def _get_driver(self, identifier, raw_data):
        selected_driver = False
        for _driver in self._drivers:
            if _driver.supported(identifier, raw_data):
                selected_driver = _driver
                break
        return selected_driver

    def _add_device(self, identifier, raw_data, **kwargs):
        driver = self._get_driver(identifier, raw_data)
        if driver:
            self._devices[identifier] = driver(identifier, self._type, raw_data, **kwargs)

        return self._devices.get(identifier)

    def _remove_device(self, identifier):
        return self._devices.pop(identifier)

    def get_type(self):
        return self._type

    def get_device(self, identifier):
        return self._devices.get(identifier, driver.DeviceNotFound(self._type))

    def connect_all_devices(self):
        for identifier, device in self._devices.items():
            device.connect()
