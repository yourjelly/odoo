# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from dateutil.parser import parse
from pytz import UTC

from odoo import fields, models
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT

from odoo.addons.odoo_payments.utils import to_major_currency

_logger = logging.getLogger(__name__)


class AdyenTransactionPayout(models.Model):
    _name = 'adyen.transaction.payout'
    _description = "Payout Transaction"
    _order = 'date desc'

    #=========== ANY FIELD BELOW THIS LINE HAS NOT BEEN CLEANED YET ===========#

    adyen_account_id = fields.Many2one(comodel_name='adyen.account', required=True)
    company_id = fields.Many2one(related='adyen_account_id.company_id', store=True)

    date = fields.Datetime()
    amount = fields.Float(string='Amount', required=True)
    currency_id = fields.Many2one(comodel_name='res.currency', required=True)
    reference = fields.Char(string='Reference', index=True, required=True)
    bank_account_id = fields.Many2one(comodel_name='adyen.bank.account')
    status = fields.Selection(string='Type', selection=[
        ('unknown', 'Unknown'),
        ('Payout', 'Payout'),
        ('PayoutReversed', 'Payout Reversed'),
    ], default='unknown')

    #=== COMPUTE METHODS ===#

    #=== CONSTRAINT METHODS ===#

    #=== CRUD METHODS ===#

    #=== ACTION METHODS ===#

    #=== BUSINESS METHODS ===#

    #=========== ANY METHOD BELOW THIS LINE HAS NOT BEEN CLEANED YET ===========#

    def _create_missing_payout(self, account_id, transaction):
        """

        Note: sudoed env

        :param int account_id: `adyen.account` id
        :param dict transaction: payout transaction details received from Adyen
        """
        currency = self.env['res.currency'].search([('name', '=', transaction['amount']['currency'])])
        bank_account = self.env['adyen.bank.account'].search([
            ('bank_account_uuid', '=', transaction.get('bankAccountDetail', {}).get('bankAccountUUID'))])
        return self.create({
            'adyen_account_id': account_id,
            'date': parse(transaction.get('creationDate')).astimezone(UTC).strftime(DEFAULT_SERVER_DATETIME_FORMAT),
            'amount': to_major_currency(transaction.get('amount', {}).get('value'), currency),
            'currency_id': currency.id,
            'reference': transaction.get('pspReference'),
            'bank_account_id': bank_account.id,
            'status': transaction.get('transactionStatus'),
        })
