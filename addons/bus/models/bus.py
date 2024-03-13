# -*- coding: utf-8 -*-
import contextlib
import datetime
import json
import logging
import os
import selectors
import threading
import time
from weakref import WeakKeyDictionary, WeakSet
from psycopg2 import InterfaceError, sql
from contextlib import suppress

import odoo
from odoo import api, fields, models
from odoo.service.server import CommonServer
from odoo.tools import date_utils
from odoo.http import root
from odoo.service.security import check_session
from ..websocket import CloseCode, InvalidStateException, Websocket, acquire_cursor

_logger = logging.getLogger(__name__)

# longpolling timeout connection
TIMEOUT = 50

# custom function to call instead of default PostgreSQL's `pg_notify`
ODOO_NOTIFY_FUNCTION = os.getenv('ODOO_NOTIFY_FUNCTION', 'pg_notify')

#----------------------------------------------------------
# Bus
#----------------------------------------------------------
def json_dump(v):
    return json.dumps(v, separators=(',', ':'), default=date_utils.json_default)

def hashable(key):
    if isinstance(key, list):
        key = tuple(key)
    return key


def channel_with_db(dbname, channel):
    if isinstance(channel, models.Model):
        return (dbname, channel._name, channel.id)
    if isinstance(channel, tuple) and len(channel) == 2 and isinstance(channel[0], models.Model):
        return (dbname, channel[0]._name, channel[0].id, channel[1])
    if isinstance(channel, str):
        return (dbname, channel)
    return channel


class ImBus(models.Model):

    _name = 'bus.bus'
    _description = 'Communication Bus'

    channel = fields.Char('Channel')
    message = fields.Char('Message')

    @api.autovacuum
    def _gc_messages(self):
        timeout_ago = fields.Datetime.now() - datetime.timedelta(seconds=TIMEOUT*2)
        domain = [('create_date', '<', timeout_ago)]
        return self.sudo().search(domain).unlink()

    @api.model
    def _sendmany(self, notifications):
        channels = set()
        values = []
        for target, notification_type, message in notifications:
            channel = channel_with_db(self.env.cr.dbname, target)
            channels.add(channel)
            values.append({
                'channel': json_dump(channel),
                'message': json_dump({
                    'type': notification_type,
                    'payload': message,
                })
            })
        self.sudo().create(values)
        if channels:
            # We have to wait until the notifications are commited in database.
            # When calling `NOTIFY imbus`, notifications will be fetched in the
            # bus table. If the transaction is not commited yet, there will be
            # nothing to fetch, and the websocket will return no notification.
            @self.env.cr.postcommit.add
            def notify():
                with odoo.sql_db.db_connect('postgres').cursor() as cr:
                    query = sql.SQL("SELECT {}('imbus', %s)").format(sql.Identifier(ODOO_NOTIFY_FUNCTION))
                    cr.execute(query, (json_dump(list(channels)), ))

    @api.model
    def _sendone(self, channel, notification_type, message):
        self._sendmany([[channel, notification_type, message]])

    @api.model
    def _poll(self, channels, last=0):
        # first poll return the notification in the 'buffer'
        if last == 0:
            timeout_ago = fields.Datetime.now() - datetime.timedelta(seconds=TIMEOUT)
            domain = [('create_date', '>', timeout_ago)]
        else:  # else returns the unread notifications
            domain = [('id', '>', last)]
        channels = [json_dump(channel_with_db(self.env.cr.dbname, c)) for c in channels]
        domain.append(('channel', 'in', channels))
        notifications = self.sudo().search_read(domain)
        # list of notification to return
        result = []
        for notif in notifications:
            result.append({
                'id': notif['id'],
                'message': json.loads(notif['message']),
            })
        return result

    def _bus_last_id(self):
        last = self.env['bus.bus'].search([], order='id desc', limit=1)
        return last.id if last else 0


#----------------------------------------------------------
# Dispatcher
#----------------------------------------------------------

class BusSubscription:
    def __init__(self, channels, last):
        self.last_notification_id = last
        self.channels = channels


class ImDispatch(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True, name=f'{__name__}.Bus')
        self._ws_to_subscription = WeakKeyDictionary()
        self._channels_to_ws = {}

    def subscribe(self, channels, last, db, websocket):
        """
        Subcribe to bus notifications. Every notification related to the given
        channels will be sent through the websocket. If a subscription is
        already present, overwrite it.
        """
        channels = {hashable(channel_with_db(db, c)) for c in channels}
        subscription = self._ws_to_subscription.get(websocket)
        if subscription:
            outdated_channels = subscription.channels - channels
            self._clear_outdated_channels(websocket, outdated_channels)
        for channel in channels:
            self._channels_to_ws.setdefault(channel, WeakSet()).add(websocket)
        self._ws_to_subscription[websocket] = BusSubscription(channels, last)
        with contextlib.suppress(RuntimeError):
            if not self.is_alive():
                self.start()
        # Dispatch past notifications if there are any.
        self._dispatch_notifications(websocket)

    def _dispatch_notifications(self, websocket):
        """
        Dispatch notifications available for the given websocket. If the
        session is expired, close the connection with the `SESSION_EXPIRED`
        close code.
        """
        subscription = self._ws_to_subscription.get(websocket)
        if not subscription:
            return
        session = root.session_store.get(websocket._session.sid)
        if not session:
            return websocket.disconnect(CloseCode.SESSION_EXPIRED)
        with acquire_cursor(session.db) as cr:
            env = api.Environment(cr, session.uid, session.context)
            if session.uid is not None and not check_session(session, env):
                return websocket.disconnect(CloseCode.SESSION_EXPIRED)
            notifications = env['bus.bus']._poll(
                subscription.channels, subscription.last_notification_id)
            if not notifications:
                return
            with suppress(InvalidStateException):
                subscription.last_notification_id = notifications[-1]['id']
                websocket.send(notifications)

    def _clear_outdated_channels(self, websocket, outdated_channels):
        """ Remove channels from channel to websocket map. """
        for channel in outdated_channels:
            self._channels_to_ws[channel].remove(websocket)
            if not self._channels_to_ws[channel]:
                self._channels_to_ws.pop(channel)

    def loop(self):
        """ Dispatch postgres notifications to the relevant websockets """
        _logger.info("Bus.loop listen imbus on db postgres")
        with odoo.sql_db.db_connect('postgres').cursor() as cr, \
             selectors.DefaultSelector() as sel:
            cr.execute("listen imbus")
            cr.commit()
            conn = cr._cnx
            sel.register(conn, selectors.EVENT_READ)
            while not stop_event.is_set():
                if sel.select(TIMEOUT):
                    conn.poll()
                    channels = []
                    while conn.notifies:
                        channels.extend(json.loads(conn.notifies.pop().payload))
                    # How to guarantee order?
                    # relay notifications to websockets that have
                    # subscribed to the corresponding channels.
                    websockets = set()
                    for channel in channels:
                        websockets.update(
                            self._channels_to_ws.get(hashable(channel), [])
                        )
                    for websocket in websockets:
                        self._dispatch_notifications(websocket)

    def run(self):
        while not stop_event.is_set():
            try:
                self.loop()
            except Exception as exc:
                if isinstance(exc, InterfaceError) and stop_event.is_set():
                    continue
                _logger.exception("Bus.loop error, sleep and retry")
                time.sleep(TIMEOUT)

# Partially undo a2ed3d3d5bdb6025a1ba14ad557a115a86413e65
# IMDispatch has a lazy start, so we could initialize it anyway
# And this avoids the Bus unavailable error messages
dispatch = ImDispatch()
stop_event = threading.Event()
CommonServer.on_stop(stop_event.set)
