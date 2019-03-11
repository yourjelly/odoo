# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _
import uuid


class SaleAdvancePaymentInv(models.TransientModel):
    _name = "sale.payment.link"
    _description = "Sales Payment Link generate"

    reference = fields.Char(string="Refernce Id")
    amount = fields.Float(string="Amount", required=True)
    link = fields.Char(string="Payment link")

    @api.model
    def default_get(self, fields):
        rec = super(SaleAdvancePaymentInv, self).default_get(fields)
        return rec

    @api.multi
    def generate_payment_link(self):
        base_url = self.env['ir.config_parameter'].sudo().get_param('web.base.url')
        active_model = self._context.get('active_model')
        active_id = self._context.get('active_id')
        inv = self.env[active_model].browse(active_id)
        if self.amount > 0 and inv.amount_total >= self.amount:
            access_token = inv.access_token if inv.access_token else str(uuid.uuid4())
            self.link = base_url + '/website_payment/pay?reference=%s&model=%s&amount=%s&access_token=%s' % (self._context.get('active_id'), self._context.get('active_model'), self.amount, access_token)
        else:
            self.link = _("The amount should be less than %s and positive value") % (inv.amount_total)
        return {
            'name': _('Generated Link'),
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'sale.payment.link',
            'res_id': self.id,
            'target': 'new',
        }
