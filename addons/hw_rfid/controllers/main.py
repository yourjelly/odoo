# # -*- coding: utf-8 -*-
# # Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import time
import json
import jinja2
import hashlib
import pygame
import requests
import sys
import os
from gtts import gTTS
from playsound import playsound

from threading import Thread, Lock

from odoo import http
from odoo.addons.hw_proxy.controllers import main as hw_proxy

from .. gpio_device.display import LCDDisplay
from .. gpio_device.led_light import LEDLight
from .. gpio_device.buzzer import Buzzer
from .. gpio_device.rfid import RFIDIN, RFIDOUT

try:
    from queue import Queue
except ImportError:
    from Queue import Queue # pylint: disable=deprecated-module

_logger = logging.getLogger(__name__)

if hasattr(sys, 'frozen'):
    # When running on compiled windows binary, we don't have access to package loader.
    path = os.path.realpath(os.path.join(os.path.dirname(__file__), '..', 'views'))
    loader = jinja2.FileSystemLoader(path)
else:
    loader = jinja2.PackageLoader('odoo.addons.hw_rfid', "views")

jinja_env = jinja2.Environment(loader=loader, autoescape=True)
jinja_env.filters["json"] = json.dumps

def get_server_token():
    server = ""
    try:
        f = open('/home/pi/odoo-remote-server.conf', 'r')
        for line in f:
            server += line
        f.close()
    except:
        server = ''

    token = ""
    try:
        f = open('/home/pi/token', 'r')
        for line in f:
            token += line
        f.close()
    except:
        token = ''
    token = token.split('\n')[0]
    server = server.split('\n')[0]

    return server, token

def greeting_message():
    currentTime = int(time.strftime('%H'))
    if currentTime < 12 :
        return 'Good morning.'
    if currentTime > 12 :
        return 'Good afternoon.'
    if currentTime > 6 :
        return 'Good evening.'

def play_text(text):
    tts = gTTS(text=text, lang='en')
    tts.save("good.mp3")
    pygame.mixer.init()
    pygame.mixer.music.load("/home/pi/odoo/good.mp3")
    pygame.mixer.music.play()
    while pygame.mixer.music.get_busy() == True:
        continue


class LCDDisplayDevice(Thread):
    def __init__(self):
        Thread.__init__(self)
        self.queue = Queue()
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
        self.queue = Queue()
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
        (server, token) = get_server_token()
        if server and token:
            try:
                server = server + '/iot_attendance'
                headers = {'Content-type': 'application/json'}

                # prepare data
                data = {'tag_type': self.rfidType, 'tag_id': tagid}

                # create hash of data with token
                hash_data = {'token': token}
                hash_data.update(data)

                payload = {
                    'data': data,
                    'token': hashlib.sha512(json.dumps(hash_data, sort_keys=True).encode('utf8')).hexdigest(),
                }

                res = requests.post(server, data=json.dumps(payload), headers=headers)
                result = json.loads(res.text).get('result')
                if result:
                    msg = greeting_message()
                    if result.get('type') == 'in':
                        msg += ' Welcome, ' + result.get('name')
                        message = 'signed in'
                    elif result.get('type') == 'out':
                        msg = ' good bye, ' + result.get('name')
                        message = 'signed out'
                    else:
                        msg = message = 'Scan complete'
                    self.lcd_display.push_message(message, result.get('name'))
                    self.beep_valid()
                    self.queue.put(result)
                    play_text(msg)
                else:
                    self.beep_invalid()
                    logging.error('RFID Attendance not registered in server')
            except Exception as e:
                logging.error(str(e))
                self.beep_invalid()
        else:
            logging.error('Server not configured')
            self.beep_invalid()


    def beep_invalid(self, timeout=0.1):
        self.led_light.on_red()
        self.buzzer.play_buzzer()
        time.sleep(timeout)
        self.led_light.off_red()
        self.buzzer.stop_buzzer()
        time.sleep(timeout)
        self.led_light.on_red()
        self.buzzer.play_buzzer()
        time.sleep(timeout)
        self.led_light.off_red()
        self.buzzer.stop_buzzer()

    def beep_valid(self, timeout=0.1):
        self.led_light.on_green()
        self.buzzer.play_buzzer()
        time.sleep(timeout)
        self.led_light.off_green()
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


class HWRFID(http.Controller):

    @http.route('/hw_rfid/status', type='http', auth='none', cors='*')
    def status_http(self, debug=None, **kwargs):
        rfid_status = jinja_env.get_template('rfid_status.html')
        return rfid_status.render()

    @http.route('/hw_rfid/longpolling/in', type='http', auth='none', cors='*', csrf=False)
    def status_longpolling_in(self, **kwargs):
        print('request recived in')
        return json.dumps(driver_in.queue.get())

    @http.route('/hw_rfid/longpolling/out', type='http', auth='none', cors='*', csrf=False)
    def status_longpolling_out(self, **kwargs):
        print('request recived out')
        return json.dumps(driver_out.queue.get())
