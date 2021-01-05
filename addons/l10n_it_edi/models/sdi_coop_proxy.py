# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import uuid
import requests


DEST_SERVER_URL = 'http://localhost:8069/'


def upload(filename, xml, test_mode):
    '''Upload an XML to fatturapa.

    :returns:        A dictionary.
    * message:       Message from fatturapa.
    * transactionId: The fatturapa ID of this request.
    * error:         An eventual error.
    * error_level:   Info, warning, error.
    '''
    payload = {
        'jsonrpc': '2.0',
        'method': 'call',
        'params': {
            'NomeFile': filename,
            'File': base64.b64encode(xml),
            'test_mode': test_mode,
        },
        'id': uuid.uuid4().hex,
    }
    result = requests.post(
        DEST_SERVER_URL + 'l10n_it_sdi/out/SdiRiceviFile/',
        json=payload,
        headers={'content-type': 'application/json'}).json()

    return result['result']
