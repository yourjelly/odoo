# # -*- coding: utf-8 -*-
# # Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import time

from threading import Thread, Lock

from odoo import http
from odoo.addons.hw_proxy.controllers import main as hw_proxy

from .. gpio_device.display import LCDDisplay
from .. gpio_device.led_light import LEDLight
from .. gpio_device.buzzer import Buzzer
from .. gpio_device.rfid import RFIDIN, RFIDOUT

try:
    from queue import LifoQueue
except ImportError:
    from Queue import LifoQueue # pylint: disable=deprecated-module

_logger = logging.getLogger(__name__)


class LCDDisplayDevice(Thread):
    def __init__(self):
        Thread.__init__(self)
        self.queue = LifoQueue()
        self.lock = Lock()
        self.lcd = LCDDisplay()
        self.initial_message()

    def initial_message(self):
        self.lcd.show_message('Welcome to Odoo')
        self.lcd.show_message(' ', LCDDisplay.LCD_LINE_2)

    def push_message(self, first_line, secound_line):
        self.lockedstart()
        self.queue.put((first_line, secound_line))

    def lockedstart(self):
        with self.lock:
            if not self.isAlive():
                self.daemon = True
                self.start()

    def run(self):
        while True:
            first_line, secound_line = self.queue.get()
            self.lcd.show_message(first_line)
            self.lcd.show_message(secound_line, LCDDisplay.LCD_LINE_2)
            time.sleep(3) # 3 second delay
            self.initial_message()


class RFIDSystem(Thread):
    def __init__(self, rfidType, rfid_class):
        Thread.__init__(self)
        self.lock = Lock()
        self.rfidType = rfidType
        self.MIFAREReader = rfid_class()
        self.lcd_display = LCDDisplayDevice()
        self.led_light = LEDLight()
        self.buzzer = Buzzer()

    def lockedstart(self):
        with self.lock:
            if not self.isAlive():
                self.daemon = True
                self.start()

    def on_scan_tag(self, tagid):
        self.lcd_display.push_message(tagid, self.rfidType)
        if self.rfidType == 'in':
            self.led_light.on_green()
            time.sleep(0.5)
            self.led_light.off_green()
        if self.rfidType == 'out':
            self.led_light.on_red()
            time.sleep(0.5)
            self.led_light.off_red()

        self.buzzer.play_buzzer()
        time.sleep(0.5)
        self.buzzer.stop_buzzer()

    def run(self):
        logging.info('RFID Reading Started Type : ' + self.rfidType)
        while True:
            self.MIFAREReader.wait_for_tag()
            (error, tag_type) = self.MIFAREReader.request()
            if not error:
                (error, uid) = self.MIFAREReader.anticoll()
                if not error:
                    tagid = ''.join(str(num) for num in uid)
                    self.on_scan_tag(tagid);
                try:
                    # Select Tag is required before Auth
                    if not self.MIFAREReader.select_tag(uid):
                        # Auth for block 10 (block 2 of sector 2) using default shipping key A
                        if not self.MIFAREReader.card_auth(self.MIFAREReader.auth_a, 10, [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF], uid):
                            # Always stop crypto1 when done working
                            self.MIFAREReader.stop_crypto()
                except:
                    pass
            time.sleep(0.5)


driver_out = RFIDSystem('out', RFIDOUT)
driver_in = RFIDSystem('in', RFIDIN)

driver_in.lockedstart()
driver_out.lockedstart()
