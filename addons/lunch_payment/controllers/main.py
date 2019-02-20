# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.payment.controllers.portal import WebsitePayment


class WebsitePaymentController(WebsitePayment):
    def _get_pay_template_values(self, values):
        res = super(WebsitePaymentController, self)._get_pay_template_values(values)
        try:
            cashmove_id = int(values.get('cashmove_id'))
        except (ValueError, TypeError):
            cashmove_id = None

        if cashmove_id:
            res['cashmove_id'] = cashmove_id

        return res

    def _get_transaction_values(self, reference, values, compute_reference=True, acquirer_id=None):
        res = super(WebsitePaymentController, self)._get_transaction_values(reference, values, compute_reference=compute_reference, acquirer_id=acquirer_id)
        cashmove_id = values.get('cashmove_id')
        if cashmove_id:
            res['cashmove_id'] = cashmove_id
        return res
