import base64
import json
import logging
import os
import platform
import requests
import subprocess
import sys
import time
import websocket

from collections import defaultdict
from functools import lru_cache
from pathlib import Path


from odoo.tests.common import ChromeBrowser as _ChromeBrowser
from odoo.tools.misc import  DotDict




class ChromeBrowser(_ChromeBrowser):
    dispatch = defaultdict(DotDict)

    _logger = logging.getLogger(__name__)
    browser_size = '1366x768'
    touch_enabled = False

    def __init__(self):
        super().__init__(self)
        self._request_id = 0
        self.register_methods()

    def _get_chrome_options(self):
        return {
            **super()._get_chrome_options(),
            # necessary to avoid CORS errors when printing from local HTML files
            '--disable-web-security': '',
        }

    def _send(self, domain, method, params=None):
        method_name = f'{domain}.{method}'
        sent_id = self._websocket_send(method_name, params=params)
        return Promise(self, sent_id, method_name)

    def __getattr__(self, attribute):
        if attribute not in self.dispatch:
            raise NotImplementedError(f"Domain {attribute} has not been implemented yet")
        return self.dispatch[attribute]

    #####################
    ## CDP API Methods ##
    #####################

    # FIXME: use kwargs-only with a generic method but allow for specific overrides for more
    # complex methods that may require some pre-processing, might require a proxy class
    # something like Method(browser, domain) where domain == 'Network'|'Page'|...
    def register_methods(self):
        self.dispatch['Network']['setCookie'] = self._network_set_cookie
        self.dispatch['Network']['enable'] = self._network_enable
        self.dispatch['Page']['enable'] = self._page_enable
        self.dispatch['Page']['navigate'] = self._page_navigate
        self.dispatch['Page']['printToPDF'] = self._page_print_to_pdf
        self.dispatch['Runtime']['enable'] = self._runtime_enable

    def _runtime_enable(self):
        return self._send('Runtime', 'enable')

    def _network_enable(self):
        return self._send('Network', 'enable')

    def _network_set_cookie(self, name, value, domain='', path=''):
        params = {
            'name': name,
            'value': value,
            'domain': domain,
            'path': path,
        }
        return self._send('Network', 'setCookie', params)

    def _page_enable(self):
        return self._send('Page', 'enable')

    def _page_navigate(self, url):
        params = {'url': url}
        return self._send('Page', 'navigate', params=params)

    def _page_print_to_pdf(self, **kwargs):
        return self._send('Page', 'printToPDF', params=kwargs)


def callback(method_name):
    def decorator(method):
        def wrapper(*args, **kwargs):
            return method(*args, **kwargs)
        wrapper._method_name = method_name
        return wrapper
    return decorator


class MetaPromise(type):

    @property
    @lru_cache(maxsize=None)
    def callbacks(cls):
        callbacks = defaultdict(lambda: "_default_callback")
        for attr in dir(cls):
            obj = None if attr == 'callbacks' else getattr(cls, attr)  # avoid endless recursion
            if callable(obj) and hasattr(obj, '_method_name'):
                callbacks[obj._method_name] = attr
        return callbacks

class Promise(metaclass=MetaPromise):

    @property
    def callbacks(self):
        return type(self).callbacks

    def __init__(self, browser, _id, method_name):
        self.browser = browser
        self.id = _id
        self.method_name = method_name
        self.response = None
        self.events = {}

    ### Callbacks ###

    def _default_callback(self, response):
        return response

    @callback('Page.navigate')
    def _page_frame_stopped_loading_callback(self, response):
        return bool(self.browser._websocket_wait_event('Page.frameStoppedLoading'))

    @callback('Page.printToPDF')
    def _page_print_to_pdf_callback(self, response):
        return base64.b64decode(response.get('result', {}).get('data', ''))

    def _resolve(self, timeout):
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                response = json.loads(self.browser.ws.recv())
            except websocket.WebSocketTimeoutException:
                continue
            if response.get('id') == self.id:
                self.response = response
                break
            else:
                key = response.get('method', response.get('id'))
                self.events[key] = response

    def resolve(self, timeout=60):
        self._resolve(timeout)
        return getattr(self, self.callbacks[self.method_name])(self.response)

    def get_event(self, event_name):
        return getattr(self, self.callbacks[event_name])(self.events.get(event_name, {}))


browser = ChromeBrowser()
