# Part of Odoo. See LICENSE file for full copyright and licensing details.

import time
from collections import defaultdict
from unittest.mock import patch

from odoo.api import Environment
from odoo.tests import common
from .common import WebsocketCase
from ..websocket import (
    CloseCode,
    Frame,
    Opcode,
    TimeoutManager,
    TimeoutReason,
    Websocket
)


@common.tagged('post_install', '-at_install')
class TestWebsocketCaryall(WebsocketCase):
    def test_lifecycle_hooks(self):
        events = []
        with patch.object(Websocket, '_event_callbacks', defaultdict(set)):
            @Websocket.onopen
            def onopen(env, websocket):  # pylint: disable=unused-variable
                self.assertIsInstance(env, Environment)
                self.assertIsInstance(websocket, Websocket)
                events.append('open')

            @Websocket.onclose
            def onclose(env, websocket):  # pylint: disable=unused-variable
                self.assertIsInstance(env, Environment)
                self.assertIsInstance(websocket, Websocket)
                events.append('close')

            ws = self.websocket_connect()
            ws.close(CloseCode.CLEAN)
            self.wait_remaining_websocket_connections()
            self.assertEqual(['open', 'close'], events)

    def test_instances_set(self):
        first_ws = self.websocket_connect()
        second_ws = self.websocket_connect()
        self.assertEqual(len(Websocket._instances), 2)
        first_ws.close(CloseCode.CLEAN)
        second_ws.close(CloseCode.CLEAN)
        self.wait_remaining_websocket_connections()
        self.assertEqual(len(Websocket._instances), 0)

    def test_timeout_manager_no_response_timeout(self):
        with patch.object(TimeoutManager, 'TIMEOUT', 10):
            timeout_manager = TimeoutManager()
            # A PING frame was just sent, if no pong has been received
            # within 10 seconds, the connection should have timed out.
            timeout_manager.acknowledge_frame_sent(Frame(Opcode.PING))
            self.assertEqual(timeout_manager._awaited_opcode, Opcode.PONG)
            with patch('time.time', return_value=time.time() + 5):
                self.assertFalse(timeout_manager.has_timed_out())
            with patch('time.time', return_value=time.time() + 10):
                self.assertTrue(timeout_manager.has_timed_out())
                self.assertEqual(timeout_manager.timeout_reason, TimeoutReason.NO_RESPONSE)

            timeout_manager = TimeoutManager()
            # A CLOSE frame was just sent, if no close has been received
            # within 10 seconds, the connection should have timed out.
            timeout_manager.acknowledge_frame_sent(Frame(Opcode.CLOSE))
            with patch('time.time', return_value=time.time() + 5):
                self.assertFalse(timeout_manager.has_timed_out())
            with patch('time.time', return_value=time.time() + 10):
                self.assertTrue(timeout_manager.has_timed_out())
                self.assertEqual(timeout_manager.timeout_reason, TimeoutReason.NO_RESPONSE)

    def test_timeout_manager_keep_alive_timeout(self):
        timeout_manager = TimeoutManager()
        with patch('time.time', return_value=time.time() + TimeoutManager.KEEP_ALIVE_TIMEOUT + 1):
            self.assertTrue(timeout_manager.has_timed_out())
            self.assertEqual(timeout_manager.timeout_reason, TimeoutReason.KEEP_ALIVE)

    def test_timeout_manager_reset_wait_for(self):
        timeout_manager = TimeoutManager()
        # PING frame
        timeout_manager.acknowledge_frame_sent(Frame(Opcode.PING))
        self.assertEqual(timeout_manager._awaited_opcode, Opcode.PONG)
        timeout_manager.acknowledge_frame_receipt(Frame(Opcode.PONG))
        self.assertIsNone(timeout_manager._awaited_opcode)

        # CLOSE frame
        timeout_manager.acknowledge_frame_sent(Frame(Opcode.CLOSE))
        self.assertEqual(timeout_manager._awaited_opcode, Opcode.CLOSE)
        timeout_manager.acknowledge_frame_receipt(Frame(Opcode.CLOSE))
        self.assertIsNone(timeout_manager._awaited_opcode)
