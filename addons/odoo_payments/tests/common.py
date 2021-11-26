# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import tagged, TransactionCase


@tagged('post_install', '-at_install')
class OdooPaymentsCommon(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.dummy_account = cls._prepare_adyen_account()

    @classmethod
    def _prepare_adyen_account(cls):
        AdyenAccount = cls.env['adyen.account']
        return AdyenAccount.create({}) # TODO create vals
