import functools
import json
import logging
import time
from urllib.parse import urlparse, parse_qsl

from odoo.addons.hw_drivers.tools import helpers
from odoo.http import request
from odoo.tools import iot_cryptography
from werkzeug.exceptions import Forbidden

_logger = logging.getLogger(__name__)
WINDOW = 5


def protect(endpoint):
    """Decorate a route to protect it with TOTP. If the IoT Box is not connected
    to a db, the route will not be protected.
    """
    fname = f"<function {endpoint.__module__}.{endpoint.__qualname__}>"

    @functools.wraps(endpoint)
    def protect_wrapper(*args, key=None, data=None, **kwargs):
        # If no db connected, we don't protect the endpoint
        if not helpers.get_odoo_server_url():
            return endpoint(*args, **kwargs)

        # Check before decrypting to avoid unnecessary computation
        signature = request.httprequest.headers.get('Authorization')
        if not signature:
            _logger.error('%s: Authentication required.', fname)
            return Forbidden('Authentication failed.')

        try:
            if key:
                # The message was too long to be RSA encrypted, it was encrypted with a symmetric key
                # we need to decrypt this symmetric key, which has been RSA encrypted, then decrypt the message
                aes_params = json.loads(iot_cryptography.rsa_decrypt(helpers.get_iot_keypair()[0], key))
                # Overwrite kwargs: no data should be passed apart from the encrypted ones
                kwargs = iot_cryptography.aes_decrypt(aes_params['secret'], aes_params['nonce'], data)
            else:
                kwargs = iot_cryptography.rsa_decrypt(helpers.get_iot_keypair()[0], data)

            kwargs = json.loads(kwargs)  # We expect a dictionary as payload
        except json.JSONDecodeError as e:
            _logger.error('%s: Invalid JSON payload: %s', fname, e)
            return Forbidden('Authentication failed.')
        except ValueError:
            _logger.error('%s: Missing required parameters', fname)
            return Forbidden('Authentication failed.')
        except TypeError:
            _logger.error('%s: Invalid payload', fname)
            return Forbidden('Authentication failed.')

        # Ensure authentication checking the signature
        db_public_key = iot_cryptography.load_stored_key(
            helpers.get_conf('db_public_key', 'iot.security')
        )
        if not verify_signature(db_public_key, request.httprequest.url, kwargs, signature):
            _logger.error('%s: Authentication required.', fname)
            return Forbidden('Authentication failed.')

        return endpoint(*args, **kwargs)
    return protect_wrapper


def verify_signature(key, url, payload, signature, window=WINDOW):
    """Verify the signature of a payload.

    :param RSAPublicKey key: public key to use for the verification
    :param str url: url of the request
    :param dict payload: payload to check
    :param str signature: signature to verify (hex representation)
    :param int window: fuzz window to account for slow fingers, network
        latency, desynchronised clocks, ..., every signature valid between
        t-window and t+window is considered valid
    :return: True if the signature is valid, False otherwise
    """
    t = time.time()
    parsed_url = urlparse(url)
    query_params = dict(parse_qsl(parsed_url.query, keep_blank_values=True))

    payload = "%s|%s|%s|%s" % (
        int(t),
        parsed_url.path,
        json.dumps(query_params, sort_keys=True),
        json.dumps(payload, sort_keys=True),
    )

    low = int(t - window)
    high = int(t + window)

    return any(
        counter for counter in range(low, high)
        if iot_cryptography.rsa_verify_signature(key, payload, signature)
    )
