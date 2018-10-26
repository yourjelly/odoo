#!/usr/bin/python3

import json
import urllib3
import logging
from threading import Thread

from . import driver, iot_config

_logger = logging.getLogger(__name__)
_server = iot_config.Server()


class MainManager(Thread):
    _managers = {}

    def start(self):
        for manager in self._managers:
            manager.start()

    def scan(self):
        for manager in self._managers:
            manager.scan()

    def add_manager(self, manager_class):
        manager = manager_class()
        type = manager.get_type()
        self._managers[type] = manager
        return manager

    def get_manager(self, type):
        return self._managers.get(type)

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
                'ip': _server.get_local_ip(),
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

    def start(self):
        pass

    def scan(self):
        pass

    def _clear_devices(self):
        self._devices = {}

    def _get_driver(self, identifier, raw_data):
        return driver.MetaDriver

    def _add_device(self, identifier, raw_data, **kwargs):
        device = False

        driver = self._get_driver(identifier, raw_data)
        if driver:
            device = driver(identifier, self._type, raw_data, **kwargs)
            if device.is_supported():
                self._devices[identifier] = device

        return device

    def _remove_device(self, identifier):
        return self._devices.pop(identifier)

    def get_type(self):
        return self._type

    def get_device(self, identifier):
        return self._devices.get(identifier, driver.DeviceNotFound(self._type))

    def connect_all_devices(self):
        for identifier, device in self._devices.items():
            device.connect()
