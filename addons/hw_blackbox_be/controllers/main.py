# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import serial

import openerp
from openerp import http

import openerp.addons.hw_proxy.controllers.main as hw_proxy

_logger = logging.getLogger(__name__)

class BlackboxDriver(hw_proxy.Proxy):
    def _lrc(self, msg):
        lrc = 0

        for character in msg:
            byte = ord(character)
            lrc = (lrc + byte) & 0xFF

        lrc = ((lrc ^ 0xFF) + 1) & 0xFF

        return lrc

    def _wrap_low_layer_around(self, high_layer):
        bcc = self._lrc(high_layer)

        low_layer = ""
        low_layer += chr(0x02)
        low_layer += high_layer
        low_layer += chr(0x03)
        low_layer += chr(bcc)

        return low_layer

    def _send_and_wait_for_ack(self, packet, serial):
        ack = 0
        MAX_RETRIES = 4

        while ack != 0x06 and int(packet[4]) < MAX_RETRIES:
            serial.write(packet)
            ack = serial.read(1)

            packet = packet[:4] + str(int(packet[4]) + 1) + packet[5:]

            if ack:
                ack = ord(ack)
            else:
                _logger.warning("did not get ACK, retrying...")
                ack = 0

        if ack == 0x06:
            return True
        else:
            _logger.error("retried " + str(MAX_RETRIES) + " times without receiving ACK, is blackbox properly connected?")
            return False

    def _send_to_blackbox(self, packet, response_size):
        ser = serial.Serial(port='/dev/ttyUSB0',
                            baudrate=19200,
                            timeout=0.300) # low level protocol timeout
        MAX_NACKS = 4
        got_response = False
        sent_nacks = 0

        if self._send_and_wait_for_ack(packet, ser):
            ser.timeout = 0.750 # reconfigure to high level timeout

            while not got_response and sent_nacks < MAX_NACKS:
                stx = ser.read(1)
                response = ser.read(response_size)
                etx = ser.read(1)
                bcc = ser.read(1)

                if stx == chr(0x02) and etx == chr(0x03) and bcc and self._lrc(response) == ord(bcc):
                    got_response = True
                    ser.write(chr(0x06))
                else:
                    _logger.warning("received ACK but not a valid response, sending NACK...")
                    sent_nacks += 1
                    ser.write(chr(0x15))

            if not got_response:
                _logger.error("sent " + str(MAX_NACKS) + " NACKS without receiving response, giving up.")
                return ""

            ser.close()
            return response
        else:
            ser.close()
            return ""

    @http.route('/hw_proxy/request_blackbox/', type='json', auth='none', cors='*')
    def request_blackbox(self, high_layer, response_size):
        to_send = self._wrap_low_layer_around(high_layer)

        return self._send_to_blackbox(to_send, response_size)
