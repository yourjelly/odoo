#!/usr/bin/python3

from threading import Thread
from . import driver


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
                        device = manager.devices[identifier]
                        break

        return device

    def ping_device(self, identifier, type=False):
        device = self.get_device(identifier, type)
        if device:
            return device.ping()
        else:
            return False

    def connect_device(self, identifier, type=False):
        device = self.get_device(identifier, type)
        if device:
            return device.connect()
        else:
            return False

    def disconnect_device(self, identifier, type=False):
        device = self.get_device(identifier, type)
        if device:
            return device.disconnect()
        else:
            return False


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
        return self._devices.get(identifier)

    def connect_device(self, identifier):
        device = self.get_device(identifier)
        if device:
            device = device.connect()
        return device

    def disconnect_device(self, identifier):
        device = self.get_device(identifier)
        if device:
            device = device.disconnect()
        return device

    def connect_all_devices(self):
        for identifier, device in self._devices.items():
            device.connect()
