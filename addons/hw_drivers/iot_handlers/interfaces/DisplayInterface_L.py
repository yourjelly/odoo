# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
from re import sub, finditer
import subprocess
from vcgencmd import Vcgencmd
import RPi.GPIO as GPIO


from odoo.addons.hw_drivers.interface import Interface

_logger = logging.getLogger(__name__)


class DisplayInterface(Interface):
    _loop_delay = 0
    connection_type = 'display'

    def get_devices(self):
        devices = {}
        default_display = {
            'default_display': {
                'name': "Default Display",
            },
        }

        xrandr_output = subprocess.check_output(['xrandr']).decode()
        for line in xrandr_output.splitlines():
            i = 0
            if 'connected' in line:
                connected_display_info = line.split()
                display_name = connected_display_info[0]
                devices[i] = {
                    'identifier' : i,
                    'name': display_name,
                }
                i += 1

        return devices or default_display
