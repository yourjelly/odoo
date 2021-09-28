# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import fields, models

_logger = logging.getLogger(__name__)


class AdyenTransactionStatus(models.Model):
    _name = 'adyen.transaction.status'  # TODO ANVFE do we really need a separate model for that? Couldn't a tracking=True do the job?
    _description = "Transaction Status"
    _order = 'date desc'
    _rec_name = 'status'

    #=========== ANY FIELD BELOW THIS LINE HAS NOT BEEN CLEANED YET ===========#

    adyen_transaction_id = fields.Many2one(comodel_name='adyen.transaction', required=True, ondelete='cascade')
    status = fields.Selection(string='Status', selection=[
        ('unknown', 'Unknown'),
        ('PendingCredit', 'Pending Credit'),
        ('CreditFailed', 'Credit Failed'),
        ('Credited', 'Credited'),
        ('Converted', 'Converted'),
        ('PendingDebit', 'Pending Debit'),
        ('DebitFailed', 'Debit Failed'),
        ('Debited', 'Debited'),
        ('DebitReversedReceived', 'Debit Reversed Received'),
        ('DebitedReversed', 'Debit Reversed'),
        # TODO chargeback does the transaction change state
        # or do we receive a new transaction for the reversed chargeback ?
        ('ChargebackReceived', 'Chargeback Received'),
        ('Chargeback', 'Chargeback'),
        ('ChargebackReversedReceived', 'Chargeback Reversed Received'),
        ('ChargebackReversed', 'Chargeback Reversed'),
        ('FundTransfer', 'Fund Transfer'),
        ('PendingFundTransfer', 'Pending Fund Transfer'),
        ('ManualCorrected', 'Manual Corrected'),
    ])
    date = fields.Datetime()  # TODO ANVFE duplicate of create_date probably
