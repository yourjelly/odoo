# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import tagged

from odoo.addons.odoo_payments.tests.common import OdooPaymentsCommon


@tagged('post_install', '-at_install')
class OdooPaymentsCommon(OdooPaymentsCommon):

    def test_account_setup(self):
        self.assertEqual(self.dummy_account.merchant_status, 'draft')
