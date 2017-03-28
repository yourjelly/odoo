# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, exceptions, fields, models


class AccountInvoice(models.Model):
    _inherit = 'account.invoice'

    payment_acquirer_id = fields.Many2one('payment.acquirer', string='Payment Acquirer', copy=False)
    payment_tx_id = fields.Many2one('payment.transaction', string='Transaction', copy=False)
    payment_request_id = fields.Many2one('account.payment.request', string='Payment Request', copy=False)

    @api.multi
    def _notification_recipients(self, message, groups):
        groups = super(AccountInvoice, self)._notification_recipients(message, groups)

        for group_name, group_method, group_data in groups:
            group_data['has_button_access'] = True

        return groups

    @api.multi
    def action_invoice_open(self):
        result = super(AccountInvoice, self).action_invoice_open()
        if result:
            PaymentRequest = self.env['account.payment.request']
            for invoice in self:
                if not invoice.payment_request_id:
                    invoice.payment_request_id = PaymentRequest.create({
                        'invoice_id': invoice.id,
                        'due_date': invoice.date_due,
                        'currency_id': invoice.currency_id.id,
                        'company_id': invoice.company_id.id,
                        'partner_id': invoice.partner_id.id,
                        'reference': invoice.number,
                        'invoiced_amount': invoice.amount_total,
                    })
        return result

    @api.multi
    def get_access_action(self):
        """ Instead of the classic form view, redirect to the online invoice for portal users. """
        self.ensure_one()
        if self.env.user.share or self.env.context.get('force_website'):
            try:
                self.check_access_rule('read')
            except exceptions.AccessError:
                pass
            else:
                if not self.payment_request_id:
                    self.payment_request_id = self.env['account.payment.request'].create({
                        'invoice_id': self.id,
                        'due_date': self.date_due,
                        'currency_id': self.currency_id.id,
                        'company_id': self.company_id.id,
                        'partner_id': self.partner_id.id,
                        'reference': self.number,
                        'invoiced_amount': self.amount_total,
                    })

                return {
                    'type': 'ir.actions.act_url',
                    'url': '/invoice/payment/%s' % self.payment_request_id.access_token,
                    'target': 'self',
                    'res_id': self.id,
                }
        return super(AccountInvoice, self).get_access_action()

    @api.multi
    def get_signup_url(self):
        self.ensure_one()
        return self.partner_id.with_context(signup_valid=True)._get_signup_url_for_action(
            action='/mail/view',
            model=self._name,
            res_id=self.id)[self.partner_id.id]
