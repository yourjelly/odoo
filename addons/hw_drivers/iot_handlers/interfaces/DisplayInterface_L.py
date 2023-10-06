# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from re import sub, finditer
import subprocess
from vcgencmd import Vcgencmd

from odoo.addons.hw_drivers.interface import Interface


class DisplayInterface(Interface):
    _loop_delay = 0
    connection_type = 'display'

    def get_devices(self):
        display_devices = {}
        hdmi_port = {'hdmi_0' : 2, 'hdmi_1': 7}
        # RPI 3B+ response on for booth hdmi port
        power_state_hdmi_0 = Vcgencmd().display_power_state(hdmi_port.get('hdmi_0'))
        x_screen = 0
        if power_state_hdmi_0 == 'on':
            iot_device = {
                'identifier': 'hdmi_0',
                'name': 'Display hdmi 0',
                'x_screen': str(x_screen),
            }
            display_devices['hdmi_0'] = iot_device
            x_screen += 1

        if not len(display_devices):
            # No display connected, create "fake" device to be accessed from another computer
            display_devices['distant_display'] = {
                'name': "Distant Display",
            }

        return display_devices
