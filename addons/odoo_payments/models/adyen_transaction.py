# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from dateutil.parser import parse
from dateutil.relativedelta import relativedelta
from pytz import UTC

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError
from odoo.osv import expression
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT

from odoo.addons.odoo_payments.utils import to_major_currency, to_minor_currency

FEES_CURRENCY_CODE = "EUR"
_logger = logging.getLogger(__name__)


class AdyenTransaction(models.Model):
    _name = 'adyen.transaction'
    _description = 'Adyen for Platforms Transaction'
    _order = 'date desc'
    _rec_name = 'reference'

    #=========== ANY FIELD BELOW THIS LINE HAS NOT BEEN CLEANED YET ===========#

    # TODO ANVFE multi-company consideration
    # Add company_id = adyen_account_id.company_id stored and with ir rules of access.

    adyen_account_id = fields.Many2one(comodel_name='adyen.account', required=True)
    company_id = fields.Many2one(related='adyen_account_id.company_id', store=True)

    reference = fields.Char(string='Reference', index=True, required=True)
    capture_reference = fields.Char(string='Capture Reference')

    total_amount = fields.Float(string='Customer Amount')
    currency_id = fields.Many2one(comodel_name='res.currency')
    merchant_amount = fields.Float(string='Merchant Amount')
    fees = fields.Float(string='Fees')
    fixed_fees = fields.Float(string='Fixed Fees')
    variable_fees = fields.Float(string='Variable Fees')
    fees_currency_id = fields.Many2one(
        comodel_name='res.currency', compute="_compute_fees_currency_id")

    date = fields.Datetime(string='Date')
    description = fields.Char(string='Description')
    signature = fields.Char(string='Signature')
    reason = fields.Char(string='Failure Reason')

    status_ids = fields.One2many(
        string="Status History",
        comodel_name='adyen.transaction.status', inverse_name='adyen_transaction_id')

    last_status_id = fields.Many2one(
        string='Last Status',
        comodel_name='adyen.transaction.status',
        compute='_compute_last_status_id',
        store=True)
    last_status_update = fields.Datetime(related='last_status_id.date', string='Last Status Update')
    status = fields.Selection(related='last_status_id.status')

    payment_method = fields.Char(string='Payment Method')
    shopper_country_id = fields.Many2one(comodel_name='res.country')
    card_country_id = fields.Many2one(comodel_name='res.country')
    commercial_card = fields.Selection([
        ('yes', 'Yes'),
        ('no', 'No'),
        ('unknown', 'Unknown'),
    ], default='unknown')

    # TODO ANVFE DISPUTES: where is this set ?
    dispute_reference = fields.Char(string='Dispute Reference')

    _sql_constraints = [
        ('reference_unique', 'unique(reference, capture_reference)',
         "A transaction with the same reference already exists."),
    ]

    #=== COMPUTE METHODS ===#

    #=== CONSTRAINT METHODS ===#

    #=== CRUD METHODS ===#

    #=== ACTION METHODS ===#

    #=== BUSINESS METHODS ===#

    #=========== ANY METHOD BELOW THIS LINE HAS NOT BEEN CLEANED YET ===========#

    @api.depends('status_ids')
    def _compute_last_status_id(self):
        self.last_status_id = False
        for transaction in self.filtered('status_ids'):
            transaction.last_status_id = transaction.status_ids.sorted('date')[-1]

    def _compute_fees_currency_id(self):
        self.fees_currency_id = self.env["res.currency"].with_context(active_test=False).search([
            ('name', '=', FEES_CURRENCY_CODE)], limit=1)

    def _get_tx_from_notification(self, account, notification):
        if notification.get('eventCode') in ['CAPTURE', 'REFUND']:
            reference = notification.get('originalReference')
            capture_reference = notification.get('pspReference')
        else:
            reference = notification.get('pspReference')
            capture_reference = notification.get('capturePspReference')

        domain = [
            ('reference', '=', reference),
            ('adyen_account_id', '=', account.id),
        ]
        if capture_reference:
            domain = expression.AND([domain, [('capture_reference', '=', capture_reference)]])

        tx_sudo = self.env['adyen.transaction'].search(domain)

        if not tx_sudo:
            # FIXME ANVFE for disputes (and other events?),
            # an adyen transaction is created with incomplete information
            tx_sudo = self.env['adyen.transaction'].create({
                'adyen_account_id': account.id,
                'reference': reference,
                'capture_reference': capture_reference,
                'description': notification.get('merchantReference'),
            })
        return tx_sudo

    @api.model
    def _handle_transaction_notification(self, data):
        """

        NOTE: sudoed env

        :returns: Found/Created transaction
        :rtype: adyen.transaction
        """
        adyen_uuid = data.get("additionalData", {}).get("metadata.adyen_uuid") or data.get('adyen_uuid')
        account = self.env['adyen.account'].search([('adyen_uuid', '=', adyen_uuid)])
        if not account:
            _logger.warning("Received payment notification for non-existing account")
            return

        tx = self.env['adyen.transaction']._get_tx_from_notification(account, data)

        # FIXME ANVFE no check on whether the event was successful...
        # success = data['success'] == 'true'
        event_code = data.get('eventCode')
        if event_code == "AUTHORISATION":
            tx._handle_authorisation_notification(data)
        elif event_code == "FEES_UPDATED":
            tx._handle_fees_updated_notification(data)
        elif event_code == "REFUND":
            tx._handle_refund_notification(data)
        elif event_code in ["CHARGEBACK", "NOTIFICATION_OF_CHARGEBACK"]:
            tx._handle_chargeback_notification(data)
        else:
            # FIXME ANVFE support CAPTURE event code ?
            # Got it for Chargeback test flows, we should directly support it IMHO
            _logger.warning(_("Unknown eventCode received: %s", event_code))

        return tx

    def _handle_authorisation_notification(self, notification_data):
        self.ensure_one()
        additional_data = notification_data.get('additionalData', {})

        currency = self.env['res.currency'].search([('name', '=', notification_data.get('amount', {}).get('currency'))])
        shopper_country = self.env['res.country'].search([('code', '=', additional_data.get('shopperCountry'))])
        commercial_card = additional_data.get('isCardCommercial', 'unknown')

        # NOTE ANVFE: issuerCountry in Standard Notification Payload is a custom setting "Include Issuer Country"
        # https://docs.adyen.com/point-of-sale/shopper-recognition/identifiers#receiving-identifiers-in-webhooks
        card_country = self.env['res.country'].search([('code', '=', additional_data.get('cardIssuingCountry', additional_data.get('issuerCountry')))])

        self.write({
            'reference': notification_data.get('pspReference'),
            'total_amount': to_major_currency(notification_data['amount']['value'], currency),
            'currency_id': currency.id,
            'date': parse(notification_data.get('eventDate')).astimezone(UTC).strftime(DEFAULT_SERVER_DATETIME_FORMAT),
            'description': notification_data.get('merchantReference'),
            'payment_method': notification_data.get('paymentMethod'),
            'shopper_country_id': shopper_country.id,
            'card_country_id': card_country.id,
            'commercial_card': commercial_card if commercial_card in ('yes', 'no', 'unknown') else 'unknown',
        })
        self._trigger_sync()

    def _handle_fees_updated_notification(self, notification_data):
        self.ensure_one()

        # TODO ANVFE assert notification_data.get('totalFees', {}).get('currency') == "EUR"

        payment_currency = self.env['res.currency'].search([
            ('name', '=', notification_data.get('totalAmount', {}).get('currency'))])
        fees_currency = self.env.ref('base.EUR')
        self.write({
            "capture_reference": notification_data.get('captureReference'),
            "fees": to_major_currency(notification_data['totalFees']['value'], fees_currency),
            "fixed_fees": to_major_currency(notification_data['fixedFees']['value'], fees_currency),
            "variable_fees": to_major_currency(notification_data['variableFees']['value'], fees_currency),

            "merchant_amount": to_major_currency(notification_data['merchantAmount']['value'], payment_currency),
            "total_amount": to_major_currency(notification_data['totalAmount']['value'], payment_currency),

            "signature": notification_data.get('signature'),
        })

    def _handle_refund_notification(self, notification_data):
        self.ensure_one()

        currency = self.env['res.currency'].search([
            ('name', '=', notification_data.get('amount', {}).get('currency'))])
        # TODO ANVFE batch write operation
        self.currency_id = currency.id
        self.date = parse(notification_data.get('eventDate')).astimezone(UTC).strftime(DEFAULT_SERVER_DATETIME_FORMAT)
        reason = notification_data.get('reason')
        if reason:
            self.reason = reason

    def _handle_chargeback_notification(self, notification_data):
        self.ensure_one()
        self.dispute_reference = notification_data.get('pspReference')

        self.adyen_account_id.message_post(
            body=_('Transaction %s has been CHARGEBACK\'ed: %s', self.description or self.reference, notification_data.get('reason')),
            subtype_xmlid="mail.mt_comment"
        )

    def _trigger_sync(self):
        sync_cron = self.env.ref('odoo_payments.adyen_sync_cron', raise_if_not_found=False)
        if sync_cron:
            # FIXME ANVFE shouldn't it be utcnow?
            sync_cron._trigger(at=fields.Datetime.now() + relativedelta(minutes=5))

    def _update_status(self, new_status, date):
        self.ensure_one()

        if not self.status_ids or self.status_ids[0].date != date:
            self.status_ids = [(0, 0, {
                'adyen_transaction_id': self.id,
                'status': new_status,
                'date': date,
            })]

    def _post_transaction_sync(self):
        """ Hook defined to perform actions on transactions after they were sync'ed """
        return

    def _refund_request(self, amount=None, reference=None):
        """

        :param float amount:
        :param str reference:

        :returns: created adyen transaction
        :rtype: `adyen.transaction` record
        """
        self.ensure_one()

        if amount is None:
            amount = self.total_amount

        if amount > self.total_amount:
            raise ValidationError(_('You cannot refund more than the original amount.'))

        converted_amount = to_minor_currency(amount, self.currency_id)
        initial_amount = to_minor_currency(self.total_amount, self.currency_id)

        # FIXME ANVFE if the EUR currency (aka fee currency) is customized on the submerchant db,
        # the fees computation may vary between proxy and submerchant DB,
        # rendering the signature invalid (and thus blocking all refunds from the submerchant db)
        # TODO harcode a fixed EUR decimal_precision, to share with the proxy ?
        fees_currency = self.fees_currency_id
        fees_amount = to_minor_currency(self.fees, fees_currency)

        reference = reference or ('Refund of %s' % self.description)
        refund_data = {
            'originalReference': self.reference,
            'modificationAmount': {
                'currency': self.currency_id.name,
                'value': converted_amount,
            },
            'initialAmount': {
                'currency': self.currency_id.name,
                'value': initial_amount,
            },
            'feesAmount': {
                'currency': FEES_CURRENCY_CODE,
                'value': fees_amount,
            },
            'date': str(self.date),
            'reference': reference,
            'payout': self.adyen_account_id.account_code,
            'adyen_uuid': self.adyen_account_id.adyen_uuid,
            'signature': self.signature,
        }
        res = self.adyen_account_id._adyen_rpc('v1/refund', refund_data)

        refund_tx = self.env['adyen.transaction'].sudo().create({
            'adyen_account_id': self.adyen_account_id.id,
            'reference': self.reference,
            'capture_reference': res['pspReference'],
            'description': refund_data.get('reference'),
            'currency_id': self.currency_id.id,
            'total_amount': to_major_currency(res['totalAmount']['value'], self.currency_id),
            # FIXME ANVFE shouldn't it use fees_currency here instead ?
            'fees': to_major_currency(res['totalFees']['value'], self.currency_id),
            'variable_fees': to_major_currency(res['totalFees']['value'], self.currency_id),
            'merchant_amount': to_major_currency(res['merchantAmount']['value'], self.currency_id),
            'date': fields.Datetime.now(),
        })
        self._trigger_sync()

        return refund_tx

    # TODO ANVFE check if used somewhere ?
    def action_refund(self):
        for tx in self:
            tx._refund_request()
