# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import tools
from odoo.tests.common import tagged
from odoo.addons.l10n_hu_edi.tests.common import L10nHuEdiTestCommon

import requests
from unittest import mock
from freezegun import freeze_time
from contextlib import contextmanager


@tagged("post_install_l10n", "-at_install", "post_install")
class L10nHuEdiTestFlowsMocked(L10nHuEdiTestCommon):
    """
    Test the Hungarian EDI flows using mocked data from the test servers (since we do not have a testing account):
        - sending of an invoice
        - sending of an credit note.
    """

    @contextmanager
    def patch_post(self, responses=None):
        """ Patch requests.post in l10n_hu_edi.connection.
        :param responses: If specified, a dict {service: response} that gives, for any service,
                          bytes that should be served as response data.
                          Otherwise, will use the default responses stored under
                          mocked_requests/{service}_response.xml
        """
        def mock_post(url, data, headers, timeout=None):
            prod_url = "https://api.onlineszamla.nav.gov.hu/invoiceService/v3"
            demo_url = "https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3"
            mocked_requests = ["manageInvoice", "queryTaxpayer", "tokenExchange", "queryTransactionStatus"]

            base_url, __, service = url.rpartition("/")
            if base_url not in (prod_url, demo_url) or service not in mocked_requests:
                self.fail(f"Invalid POST url: {url}")

            with tools.file_open(f"l10n_hu_edi/tests/mocked_requests/{service}_request.xml", "rb") as expected_request_file:
                self.assertXmlTreeEqual(
                    self.get_xml_tree_from_string(data),
                    self.get_xml_tree_from_string(expected_request_file.read()),
                )

            mock_response = mock.Mock(spec=requests.Response)
            mock_response.status_code = 200
            mock_response.headers = ""

            if responses and service in responses:
                mock_response.text = responses[service]
            else:
                with tools.file_open(f"l10n_hu_edi/tests/mocked_requests/{service}_response.xml", "r") as response_file:
                    mock_response.text = response_file.read()
            return mock_response

        with mock.patch("odoo.addons.l10n_hu_edi.models.l10n_hu_edi_connection.requests.post", side_effect=mock_post, autospec=True):
            yield

    def test_send_invoice_and_credit_note(self):
        with self.patch_post(), \
                mock.patch("odoo.addons.l10n_hu_edi.models.l10n_hu_edi_connection.AES_ECB_Cipher.decrypt", return_value="token", autospec=True), \
                freeze_time("2024-01-25T15:28:53Z"):
            invoice = self.create_invoice_simple()
            invoice.action_post()
            invoice.action_process_edi_web_services(with_commit=False)
            self.assertRecordValues(invoice.edi_document_ids, [{"error": False}])
            self.assertRecordValues(invoice.l10n_hu_edi_active_transaction_id, [{"state": "confirmed"}])
            self.assertRecordValues(invoice, [{"edi_state": "sent"}])

            credit_note = self.create_reversal(invoice)
            credit_note.action_post()
            credit_note.action_process_edi_web_services(with_commit=False)
            self.assertRecordValues(credit_note.edi_document_ids, [{"error": False}])
            self.assertRecordValues(credit_note.l10n_hu_edi_active_transaction_id, [{"state": "confirmed"}])
            self.assertRecordValues(invoice, [{"edi_state": "sent"}])

    def test_send_invoice_warning(self):
        with tools.file_open("l10n_hu_edi/tests/mocked_requests/queryTransactionStatus_response_warning.xml", "r") as response_file:
            response_data = response_file.read()
        with self.patch_post({"queryTransactionStatus": response_data}), \
                mock.patch("odoo.addons.l10n_hu_edi.models.l10n_hu_edi_connection.AES_ECB_Cipher.decrypt", return_value="token", autospec=True), \
                freeze_time("2024-01-25T15:28:53Z"):
            invoice = self.create_invoice_simple()
            invoice.action_post()
            invoice.action_process_edi_web_services(with_commit=False)
            self.assertRecordValues(invoice.edi_document_ids, [{
                "error": "<p>The invoice was accepted by the NAV, but warnings were reported. To reverse, create a credit note.</p>",
            }])
            self.assertRecordValues(invoice.l10n_hu_edi_active_transaction_id, [{"state": "confirmed_warning"}])
            self.assertRecordValues(invoice, [{"edi_state": "sent"}])

    def test_send_invoice_error(self):
        with tools.file_open("l10n_hu_edi/tests/mocked_requests/queryTransactionStatus_response_error.xml", "r") as response_file:
            response_data = response_file.read()
        with self.patch_post({"queryTransactionStatus": response_data}), \
                mock.patch("odoo.addons.l10n_hu_edi.models.l10n_hu_edi_connection.AES_ECB_Cipher.decrypt", return_value="token", autospec=True), \
                freeze_time("2024-01-25T15:28:53Z"):
            invoice = self.create_invoice_simple()
            invoice.action_post()
            invoice.action_process_edi_web_services(with_commit=False)
            self.assertRecordValues(invoice.edi_document_ids, [{
                "error": "<p>The invoice was rejected by the NAV. Reset to draft and re-send.</p>",
            }])
            self.assertRecordValues(invoice.l10n_hu_edi_active_transaction_id, [{"state": "rejected"}])
            self.assertRecordValues(invoice, [{"edi_state": "sent"}])
