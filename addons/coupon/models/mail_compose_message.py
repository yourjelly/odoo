# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class MailComposeMessage(models.TransientModel):
    _inherit = 'mail.compose.message'

    def send_mail(self, **kwargs):
        if self._context.get('mark_coupon_as_sent'):
            coupon_wizard = self.filtered_domain([('model', '=', 'coupon.coupon'), ('partner_ids', '!=', False)])
            # Mark coupon as sent in sudo, as helpdesk users don't have the right to write on coupons
            self.env["coupon.coupon"].sudo().browse(coupon_wizard.mapped('res_id')).state = 'sent'
        return super().send_mail(**kwargs)
