# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
from contextlib import contextmanager
from unittest.mock import patch
from odoo.addons.l10n_in_edi_ewaybill.models.account_edi_format import AccountEdiFormat
from odoo.tests import common
from odoo.tools import file_open


class L10ninEwaybillMockgateway(common.BaseCase):
    """ Mock the connection to the e-Way Bill server to return the response
    from the json file.
    """

    @contextmanager
    def MockL10ninEwaybill(self):

        def _l10n_in_edi_ewaybill_connect_to_server(company, url_path, params):
            """ Mock the connection to the e-Way Bill server to return the response
            from the json file.
            """
            json_data = json.load(file_open('l10n_in_edi_ewaybill/tests/ewaybill_data.txt', 'r'))
            if url_path == "/iap/l10n_in_edi_ewaybill/1/generate":
                self.assertDictEqual(params['json_payload'], json_data[params['json_payload']['docNo']])

            result = {
                "/iap/l10n_in_edi_ewaybill/1/authenticate": {
                    "status_cd": "1"
                },
                "/iap/l10n_in_edi_ewaybill/1/generate": {
                    "ewayBillNo": 123456789012,
                    "success": True,
                },
                "/iap/l10n_in_edi_ewaybill/1/cancel": {
                    "success": True,
                },
                "/iap/l10n_in_edi_ewaybill/1/getewaybillgeneratedbyconsigner": {
                    "ewayBillNo": 123456789012,
                    "success": True,
                },
            }
            if url_path == "/iap/l10n_in_edi_ewaybill/1/generate" and params['json_payload']['docNo'] == 'INV/2019/00003':
                return {
                    "error": [{
                        "code": "604",
                    }]
                }
            return result[url_path]

        try:
            with patch.object(AccountEdiFormat, '_l10n_in_edi_ewaybill_connect_to_server',
                              side_effect=_l10n_in_edi_ewaybill_connect_to_server):
                yield
        finally:
            pass
