# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class PaymentTransaction(models.Model):
    _inherit = 'payment.transaction'

    payment_request_id = fields.Many2one('account.payment.request', string='Invoice Payment')
