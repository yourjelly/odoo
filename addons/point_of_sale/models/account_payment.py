# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _


class AccountPayment(models.Model):
    _inherit = 'account.payment'

    pos_payment_id = fields.Many2one('pos.payment', string="POS Payment", help="POS Payment used to generate this account payment.")


class AccountPaymentRegister(models.TransientModel):
    _inherit = 'account.payment.register'

    def _create_payment_vals_from_wizard(self):
        result = super()._create_payment_vals_from_wizard()
        if self._context.get('pos_payment_id'):
            result['pos_payment_id'] = self._context.get('pos_payment_id')
        return result
