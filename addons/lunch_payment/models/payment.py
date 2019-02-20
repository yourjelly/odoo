# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class PaymentTransaction(models.Model):
    _inherit = 'payment.transaction'

    cashmove_id = fields.Many2one('lunch.cashmove')

    def _reconcile_after_transaction_done(self):
        self.mapped('cashmove_id').action_confirm()
        return super(PaymentTransaction, self)._reconcile_after_transaction_done()
