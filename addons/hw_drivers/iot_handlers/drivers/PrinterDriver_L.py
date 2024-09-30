# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from base64 import b64decode
from cups import IPPError, IPP_PRINTER_IDLE, IPP_PRINTER_PROCESSING, IPP_PRINTER_STOPPED
import dbus
import io
import logging
import netifaces as ni
from PIL import Image, ImageOps
import re
import subprocess

from odoo import http
from odoo.addons.hw_drivers.connection_manager import connection_manager
from odoo.addons.hw_drivers.controllers.proxy import proxy_drivers
from odoo.addons.hw_drivers.driver import Driver
from odoo.addons.hw_drivers.event_manager import event_manager
# from odoo.addons.hw_drivers.iot_handlers.interfaces.PrinterInterface_L import PPDs, conn, cups_lock
from odoo.addons.hw_drivers.main import iot_devices
from odoo.addons.hw_drivers.tools import helpers
from odoo.addons.hw_drivers.websocket_client import send_to_controller

_logger = logging.getLogger(__name__)

RECEIPT_PRINTER_COMMANDS = {
    'star': {
        'center': b'\x1b\x1d\x61\x01', # ESC GS a n
        'cut': b'\x1b\x64\x02',  # ESC d n
        'title': b'\x1b\x69\x01\x01%s\x1b\x69\x00\x00',  # ESC i n1 n2
        'drawers': [b'\x07', b'\x1a']  # BEL & SUB
    },
    'escpos': {
        'center': b'\x1b\x61\x01',  # ESC a n
        'cut': b'\x1d\x56\x41\n',  # GS V m
        'title': b'\x1b\x21\x30%s\x1b\x21\x00',  # ESC ! n
        'drawers': [b'\x1b\x3d\x01', b'\x1b\x70\x00\x19\x19', b'\x1b\x70\x01\x19\x19']  # ESC = n then ESC p m t1 t2
    }
}

def cups_notification_handler(message, uri, device_identifier, state, reason, accepting_jobs):
    if device_identifier in iot_devices:
        reason = reason if reason != 'none' else None
        state_value = {
            IPP_PRINTER_IDLE: 'connected',
            IPP_PRINTER_PROCESSING: 'processing',
            IPP_PRINTER_STOPPED: 'stopped'
        }
        iot_devices[device_identifier].update_status(state_value[state], message, reason)


# Create a Cups subscription if it doesn't exist yet
# try:
#     conn.getSubscriptions('/printers/')
# except IPPError:
#     conn.createSubscription(
#         uri='/printers/',
#         recipient_uri='dbus://',
#         events=['printer-state-changed']
#     )

# Listen for notifications from Cups
# bus = dbus.SystemBus()
# bus.add_signal_receiver(cups_notification_handler, signal_name="PrinterStateChanged", dbus_interface="org.cups.cupsd.Notifier")


class PrinterDriver(Driver):
    connection_type = 'printer'

    def __init__(self, identifier, device):
        super(PrinterDriver, self).__init__(identifier, device)
        self.device_type = 'printer'
        self.device_connection = device.get('device-class', 'DEVICECLASS').lower()
        self.device_name = device.get('device-make-and-model', 'MAKENMODEL')
        self.state = {
            'status': 'connected',
            'message': 'Connected',
            'reason': None,
        }
        self.device_subtype = "label_printer"
        self.send_status()

        self._actions.update({
            'print_receipt': self.print_receipt,
            '': self._action_default,
        })

    @classmethod
    def supported(cls, device):
        return True
        if device.get('supported', False):
            return True
        protocol = ['dnssd', 'lpd', 'socket']
        if (
                any(x in device['url'] for x in protocol)
                and device['device-make-and-model'] != 'Unknown'
                or (
                'direct' in device['device-class']
                and 'serial=' in device['url']
        )
        ):
            model = cls.get_device_model(device)
            ppd_file = ''
            for ppd in PPDs:
                if model and model in PPDs[ppd]['ppd-product']:
                    ppd_file = ppd
                    break
            with cups_lock:
                if ppd_file:
                    conn.addPrinter(name=device['identifier'], ppdname=ppd_file, device=device['url'])
                else:
                    conn.addPrinter(name=device['identifier'], device=device['url'])

                conn.setPrinterInfo(device['identifier'], device['device-make-and-model'])
                conn.enablePrinter(device['identifier'])
                conn.acceptJobs(device['identifier'])
                conn.setPrinterUsersAllowed(device['identifier'], ['all'])
                conn.addPrinterOptionDefault(device['identifier'], "usb-no-reattach", "true")
                conn.addPrinterOptionDefault(device['identifier'], "usb-unidir", "true")
            return True
        return False

    @classmethod
    def get_device_model(cls, device):
        return 'PrinterModel'
        device_model = ""
        if device.get('device-id'):
            for device_id in [device_lo for device_lo in device['device-id'].split(';')]:
                if any(x in device_id for x in ['MDL', 'MODEL']):
                    device_model = device_id.split(':')[1]
                    break
        elif device.get('device-make-and-model'):
            device_model = device['device-make-and-model']
        return re.sub(r"[\(].*?[\)]", "", device_model).strip()

    @classmethod
    def get_status(cls):
        return {'status': 'connected', 'messages': ''}

    def disconnect(self):
        return {'status': 'disconnected', 'messages': 'Printer was disconnected'}


    def send_status(self):
        """ Sends the current status of the printer to the connected Odoo instance.
        """
        self.data = {
            'value': '',
            'state': self.state,
        }
        event_manager.device_changed(self)

    def print_raw(self, data, landscape=False, duplex=True):
        _logger.critical("Oi in print raw")
        return
        """
        Print raw data to the printer
        :param data: The data to print
        :param landscape: Print in landscape mode (Default: False)
        :param duplex: Print in duplex mode (recto-verso) (Default: True)
        """
        options = []
        if landscape:
            options.extend(['-o', 'orientation-requested=4'])
        if not duplex:
            options.extend(['-o', 'sides=one-sided'])
        cmd = ["lp", "-d", self.device_identifier, *options]

        _logger.debug("Printing using command: %s", cmd)
        process = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        process.communicate(data)
        if process.returncode != 0:
            # The stderr isn't meaningful, so we don't log it ('No such file or directory')
            _logger.error('Printing failed: printer with the identifier "%s" could not be found',
                          self.device_identifier)

    def print_receipt(self, data):
        _logger.critical("Oi in print receipt")
        return
        receipt = b64decode(data['receipt'])
        im = Image.open(io.BytesIO(receipt))

        # Convert to greyscale then to black and white
        im = im.convert("L")
        im = ImageOps.invert(im)
        im = im.convert("1")

        print_command = getattr(self, 'format_%s' % self.receipt_protocol)(im)
        self.print_raw(print_command)


    def _action_default(self, data):
        self.print_raw(b64decode(data['document']))
        send_to_controller(self.connection_type, {'print_id': data['print_id'], 'device_identifier': self.device_identifier})


class PrinterController(http.Controller):

    @http.route('/hw_proxy/default_printer_action', type='json', auth='none', cors='*')
    def default_printer_action(self, data):
        printer = next((d for d in iot_devices if iot_devices[d].device_type == 'printer' and iot_devices[d].device_connection == 'direct'), None)
        if printer:
            iot_devices[printer].action(data)
            return True
        return False


proxy_drivers['printer'] = PrinterDriver
