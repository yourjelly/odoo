import base64
import json
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


import odoo


from odoo.tools import config
from odoo.tools.misc import find_in_path, DotDict


class ChromeBrowser:

    dispatch = defaultdict(DotDict)

    def __init__(self):
        self.port = config['chrome_port']
        self.url = self._get_websocket_url()
        self.ws = self._connect()
        self._request_id = 0
        self._id_to_callback_map = {}
        self.register()

    def register(self):
        self.register_methods()
        self.register_callbacks()

    @property
    def request_id(self):
        # TODO: what if the server is restarted but not the external chrome process?
        _id = self._request_id
        self._request_id += 1
        return _id

    def _get_websocket_url(self):
        url = f'http://127.0.0.1:{self.port}/json'
        try:
            r = requests.get(url, timeout=3)
            if r.ok:
                # if chrome crashes internally, this will fail
                # e.g. if headerTemplate or footerTemplate contain dynamically-loaded content
                # such as <link> or any external document that is not embedded into the template
                return r.json()[0]['webSocketDebuggerUrl']
        except requests.exceptions.ConnectionError:
            # start chrome manually
            # use odoo.tools.config['addons_path'] ?
            for addons_path in odoo.addons.__path__:
                service_path = Path(addons_path) / 'chrome_printing' / 'chrome_service.sh'
                if service_path.exists():
                    break
            # the script should check for the chrome executable that can be used, naming
            # depends on distribution and which version is installed
            self._spawn_chrome([
                service_path.resolve(),
                '1366x720',
                '127.0.0.1',
                '8969',
                '/tmp/odoo/chrome_printing',
            ])
            # need to wait for chrome to start listening...
            time.sleep(1)
            r = requests.get(url, timeout=3)
            if r.ok:
                return r.json()[0]['webSocketDebuggerUrl']

    def _spawn_chrome(self, cmd):
        if os.name != 'posix':
            return
        pid = os.fork()
        if pid != 0:
            return pid
        else:
            if platform.system() != 'Darwin':
                # since the introduction of pointer compression in Chrome 80 (v8 v8.0),
                # the memory reservation algorithm requires more than 8GiB of virtual mem for alignment
                # this exceeds our default memory limits.
                # OSX already reserve huge memory for processes
                import resource
                resource.setrlimit(resource.RLIMIT_AS, (resource.RLIM_INFINITY, resource.RLIM_INFINITY))
            # redirect browser stderr to /dev/null
            with open(os.devnull, 'wb', 0) as stderr_replacement:
                os.dup2(stderr_replacement.fileno(), sys.stderr.fileno())
            os.execv(cmd[0], cmd)

    def _connect(self):
        ws = websocket.create_connection(self.url)
        if ws.getstatus() != 101:
            raise Exception("Cannot connect to CDT WebSocket")
        ws.settimeout(0.01)
        return ws

    def _send(self, domain, method, params=None):
        _id = self.request_id
        method_name = f'{domain}.{method}'
        payload = {
            'id': _id,
            'method': method_name,
            'params': params or {},
        }
        self._id_to_callback_map[_id] = self.callbacks[method_name]
        self.ws.send(json.dumps(payload))
        return Promise(self, _id, method_name)

    def __getattr__(self, attribute):
        if attribute not in self.dispatch:
            raise NotImplementedError(f"Domain {attribute} has not been implemented yet")
        return self.dispatch[attribute]

    def _handle_by_id(self, _id, response):
        return self._id_to_callback_map[_id](response)

    def _handle_by_method(self, method, response):
        return self.callbacks[method](response)

    def _handle_callback(self, response):
        _id = response.get('id')
        method = response.get('method')
        if _id is not None:
            return self._handle_by_id(_id, response)
        elif method is not None:
            return self._handle_by_method(method, response)
        else:
            raise Exception("Cannot handle CDP response: %r" % response)

    #####################
    ## CDP API Methods ##
    #####################

    def register_methods(self):
        self.dispatch['Network']['setCookie'] = self._network_set_cookie
        self.dispatch['Page']['enable'] = self._page_enable
        self.dispatch['Page']['navigate'] = self._page_navigate
        self.dispatch['Page']['printToPDF'] = self._page_print_to_pdf

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

    #######################
    ## CDP API Callbacks ##
    #######################

    def register_callbacks(self):
        self.callbacks = defaultdict(lambda: self._default_callback)
        self.callbacks['Page.navigate'] = self._page_navigate_callback
        self.callbacks['Page.printToPDF'] = self._page_print_to_pdf_callback


    def _default_callback(self, response):
        # TODO: logging and error handling
        return response

    def _page_navigate_callback(self, response):
        return response.get('result', {}).get('frameId', False)

    def _page_print_to_pdf_callback(self, response):
        return response.get('result', {}).get('data', '')

    #######################
    ## CDP API Main loop ##
    #######################

    def wait(self, timeout=10):
        start_time = time.time()
        results = []
        while time.time() - start_time < timeout:
            try:
                response = json.loads(self.ws.recv())
            except websocket.WebSocketTimeoutException:
                continue
            results.append(self._handle_callback(response))
        return results

    def _wait_for_event(self, event, timeout=10):
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                response = json.loads(self.ws.recv())
                if response.get('method') == event:
                    return response
            except websocket.WebSocketTimeoutException:
                continue
        return False


def callback(method_name):
    def decorator(method):
        def wrapper(*args, **kwargs):
            return method(*args, **kwargs)
        wrapper._method_name = method_name
        return wrapper
    return decorator


class MetaPromise(type):

    @property
    @lru_cache(maxsize=None)        # TODO: replace by functools.cache when min py ver == 3.8
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
        return bool(self.browser._wait_for_event('Page.frameStoppedLoading'))

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

    def resolve(self, timeout=10):
        self._resolve(timeout)
        return getattr(self, self.callbacks[self.method_name])(self.response)

    def get_event(self, event_name):
        return getattr(self, self.callbacks[event_name])(self.events.get(event_name, {}))


browser = ChromeBrowser()
