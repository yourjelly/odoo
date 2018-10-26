import importlib.util
import os

from odoo import modules
from . import manager, driver_network, driver_bluetooth, driver_usb

driversList = os.listdir("/home/pi/odoo/addons/hw_drivers/drivers")
for driver in driversList:
    path = "/home/pi/odoo/addons/hw_drivers/drivers/" + driver
    spec = importlib.util.spec_from_file_location(driver, path)
    if spec:
        foo = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(foo)


if not getattr(modules, '_iot_daemon_started', False):
    # DMM for Devices Main Manager
    DMM = manager.MainManager()

    DMM.add_manager(driver_network.NetworkManager)
    DMM.add_manager(driver_bluetooth.BTManager)
    DMM.add_manager(driver_usb.USBManager)

    DMM.start()

    # Did this because of the
    modules._iot_daemon_started = True

