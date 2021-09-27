# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
from datetime import timedelta

from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError
from odoo.tools import format_amount, format_datetime

from odoo.addons.odoo_payments.util import to_major_currency


_logger = logging.getLogger(__name__)


class AdyenAccountBalance(models.Model):
    _name = 'adyen.account.balance'
    _description = 'Adyen Account Balance'

    #=========== ANY FIELD BELOW THIS LINE HAS NOT BEEN CLEANED YET ===========#

    adyen_account_id = fields.Many2one('adyen.account', required=True, ondelete='cascade')
    currency_id = fields.Many2one('res.currency')
    balance = fields.Float(default=0.0)
    on_hold = fields.Float(default=0.0)
    pending = fields.Float(default=0.0)

    #=== COMPUTE METHODS ===#

    #=== CONSTRAINT METHODS ===#

    #=== CRUD METHODS ===#

    #=== ACTION METHODS ===#

    #=== BUSINESS METHODS ===#

    #=========== ANY METHOD BELOW THIS LINE HAS NOT BEEN CLEANED YET ===========#

    @api.model
    def get_account_balance(self):
        if not self.user_has_groups('base.group_erp_manager'):
            raise AccessError(_("You can't access account balance."))

        if not self.env.company.adyen_account_id:
            return {}

        balance_fields = {'balance': 'balance', 'onHoldBalance': 'on_hold', 'pendingBalance': 'pending'}
        balances = self.env['adyen.account.balance'].sudo().search([
            ('adyen_account_id', '=', self.env.company.adyen_account_id.id)
        ])

        delta = fields.Datetime.now() - timedelta(hours=1)
        if not balances or any(b.write_date <= delta for b in balances):
            response = {}
            try:
                response = self.env.company.adyen_account_id._adyen_rpc('v1/account_holder_balance', {
                    'accountHolderCode': self.env.company.adyen_account_id.account_holder_code,
                })
            except UserError as e:
                _logger.warning(_('Cannot update account balance, showing previous values: %s', e))

            balances.write({
                f: 0 for f in balance_fields.values()
            })
            for total_balance, adyen_balances in response.get('totalBalance', {}).items():
                for balance in adyen_balances:
                    currency = self.env['res.currency'].search([('name', '=', balance.get('currency'))])
                    bal = balances.filtered(lambda b: b.currency_id == currency)
                    if not bal:
                        bal = self.env['adyen.account.balance'].sudo().create({
                            'adyen_account_id': self.env.company.adyen_account_id.id,
                            'currency_id': currency.id,
                        })
                        balances |= bal
                    bal[balance_fields.get(total_balance)] = to_major_currency(
                        balance.get('value', 0), currency)

        warning_delta = fields.Datetime.now() - timedelta(hours=2)
        return [{
            'currency': b.currency_id.name,
            'balance': format_amount(self.env, b.balance, b.currency_id),
            'payout_date': format_datetime(self.env, self.env.company.adyen_account_id.next_scheduled_payout, dt_format='short'),
            'last_update_warning': b.write_date <= warning_delta,
            'last_update': format_datetime(self.env, b.write_date),
        } for b in balances]
