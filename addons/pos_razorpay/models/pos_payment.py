# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields

class PosPayment(models.Model):

    _inherit = "pos.payment"

    razorpay_authcode = fields.Char('Razorpay APPR Code')
    razorpay_issuer_card_no = fields.Char('Razorpay Issue Card No Last 4 digits')
    razorpay_issuer_bank = fields.Char('Razorpay Issuer Bank')
    razorpay_payment_method = fields.Char('Razorpay Payment Method')
    razorpay_reference_no = fields.Char('Razorpay Merchant Reference No.')
    razorpay_card_scheme = fields.Char('Razorpay Card Scheme')

class PosOrder(models.Model):

    _inherit = 'pos.order'

    @api.model
    def _payment_fields(self, order, ui_paymentline):
        fields = super()._payment_fields(order, ui_paymentline)
        fields.update({
                'razorpay_authcode': ui_paymentline.get('razorpay_authcode'),
                'razorpay_issuer_card_no': ui_paymentline.get('razorpay_issuer_card_no'),
                'razorpay_issuer_bank': ui_paymentline.get('razorpay_issuer_bank'),
                'razorpay_payment_method':ui_paymentline.get('razorpay_payment_method'),
                'razorpay_reference_no': ui_paymentline.get('razorpay_reference_no'),
                'razorpay_card_scheme': ui_paymentline.get('razorpay_card_scheme')
            })
        return fields
