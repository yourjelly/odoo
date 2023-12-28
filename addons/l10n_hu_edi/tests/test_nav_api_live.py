# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase, tagged

import contextlib
import logging
from unittest import skipIf

_logger = logging.getLogger(__name__)

PROD_CRED = TEST_CRED = {}
with contextlib.suppress(ImportError):
    from .credentials import PROD_CRED, TEST_CRED

@tagged("external_l10n", "post_install", "-at_install", "-standard", "external")
class L10nHuEdiTestNavApiLive(TransactionCase):
    @skipIf(not TEST_CRED, "no NAV credentials")
    def test_token_test(self):
        result = self.env["l10n_hu_edi.connection"].do_token_exchange(TEST_CRED)
        self.assertTrue(result["token"])
        self.assertTrue(result["token_validity_to"])

    @skipIf(not PROD_CRED, "no NAV credentials")
    def test_token_prod(self):
        result = self.env["l10n_hu_edi.connection"].do_token_exchange(PROD_CRED)
        self.assertTrue(result["token"])
        self.assertTrue(result["token_validity_to"])
