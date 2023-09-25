# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class PaymentToken(models.Model):
    _inherit = 'payment.token'

    razorpay_customer_id = fields.Char(string="Razorpay Customer ID", readonly=True)
