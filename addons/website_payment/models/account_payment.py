# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models
from odoo.addons import account_payment


class AccountPayment(account_payment.AccountPayment):

    is_donation = fields.Boolean(string="Is Donation", related="payment_transaction_id.is_donation")
