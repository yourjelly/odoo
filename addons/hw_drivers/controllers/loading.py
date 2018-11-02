#!/usr/bin/python3

from odoo import modules
from . import manager, driver_network, driver_bluetooth, driver_usb

if not getattr(modules, '_iot_daemon_started', False):
    # DMM for Devices Main Manager
    DMM = manager.MainManager()

    DMM.add_manager(driver_network.NetworkManager)
    DMM.add_manager(driver_bluetooth.BTManager)
    DMM.add_manager(driver_usb.USBManager)

    DMM.import_drivers()
    DMM.start()

    # Did this because of the
    modules._iot_daemon_started = True