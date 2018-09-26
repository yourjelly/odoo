# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import time
import json
import requests
import hashlib
from pirc522 import RFID
import RPi.GPIO as GPIO
from threading import Thread, Lock

from odoo.addons.hw_proxy.controllers import main as hw_proxy

_logger = logging.getLogger(__name__)


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


class RFIDReader(RFID):
    def dev_read(self, address):
        res = super(RFIDReader, self).dev_read(address)
        if res == 0:
            self.is_connected = False
        else:
            self.is_connected = True
        return res


class RFIDDriver(Thread):
    def __init__(self, rfidType):
        Thread.__init__(self)
        self.lock = Lock()
        self.rfidType = rfidType
        GPIO.setwarnings(False)
        if rfidType == 'in':
            self.MIFAREReader = RFIDReader()
        else:
            self.MIFAREReader = RFIDReader(bus=1, device=2, pin_rst=33, pin_irq=37)
        self.rfidType = rfidType
        self.buzzer_pin = 7
        GPIO.setup(self.buzzer_pin, GPIO.OUT)

    def lockedstart(self):
        with self.lock:
            if not self.isAlive():
                self.daemon = True
                self.start()

    def get_status(self):
        self.status = {'messages': []}
        if self.MIFAREReader.is_connected:
            self.status['status'] = 'connected'
        else:
            self.status['status'] = 'disconnected'
        return self.status

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
                result = json.loads(res.text)
                result = result.get('result')
                if result:
                    self.beep_valid()
                else:
                    self.beep_invalid()
                    logging.error('RFID Attendance not registered in server')
            except Exception as e:
                logging.error(str(e))
                self.beep_invalid()
        else:
            logging.error('Server not configured')
            self.beep_invalid()

    def buzzer_tone(self, timeout):
        GPIO.output(self.buzzer_pin, GPIO.HIGH)
        time.sleep(timeout)
        GPIO.output(self.buzzer_pin, GPIO.LOW)
        time.sleep(timeout)

    def beep_invalid(self, timeout=0.1):
        self.buzzer_tone(timeout)
        self.buzzer_tone(timeout)

    def beep_valid(self, timeout=0.1):
        self.buzzer_tone(timeout)

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
                    logging.info("RFID Tag detected UID: " + tagid)

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


driver_out = RFIDDriver('out')
driver_in = RFIDDriver('in')

driver_in.lockedstart()
driver_out.lockedstart()

hw_proxy.drivers['rfid_in'] = driver_in
hw_proxy.drivers['rfid_out'] = driver_out
