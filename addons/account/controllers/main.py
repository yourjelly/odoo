# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
# import logging

from odoo import http, _
from odoo.http import request
from odoo.exceptions import AccessError


class InvoicePayment(http.Controller):

    def _prepare_invoice_report_attachment(self, invoice_id, report_name, token=None, pdf_view_right=None):
        if token or pdf_view_right:
            pdf = request.env['report'].sudo().get_pdf([invoice_id], report_name)
        else:
            pdf = request.env['report'].get_pdf([invoice_id], report_name)
        return base64.b64encode(pdf)

    def _get_invoice_payment_request(self, payment_request_id, token=None, currency_id=None, **kw):
        # find payment request or create a new payment request
        env = request.env
        if token:
            payment_request = env['account.payment.request'].sudo().search([('access_token', '=', token)], limit=1)
            currency_id = currency_id and int(currency_id) or env.user.sudo().company_id.currency_id.id
        else:
            payment_request = env['account.payment.request'].search([('id', '=', payment_request_id)], limit=1)
            currency_id = currency_id and int(currency_id) or env.user.company_id.currency_id.id

        return payment_request, currency_id


    @http.route(['/invoice/payment/<int:payment_request_id>'], type='http', auth="user", website=True)
    def invoice_pay_user(self, *args, **kwargs):
        return self.invoice_pay(*args, **kwargs)

    @http.route(['/invoice/payment/<token>'], type='http', auth='public', website=True)
    def invoice_pay(self, payment_request_id=None, token=None, pdf=None, currency_id=None, **kw):
        payment_request, currency_id = self._get_invoice_payment_request(payment_request_id, token, **kw)
        if not token:
            try:
                payment_request.invoice_id.check_access_rights('read')
                payment_request.invoice_id.check_access_rule('read')
            except AccessError:
                return request.render("website.403")

        env = request.env
        reference = env['payment.transaction'].get_next_reference(payment_request.reference)
        # transaction = payment_request.payment_transaction_id
        # if pdf and token:
        #     # print report as sudo, since it require access to taxes, payment term, ... and portal
        #     # does not have those access rights.
        #     pdf = env['report'].sudo().get_pdf([payment_request.invoice_id.id], 'account.report_invoice')

        #     pdfhttpheaders = [
        #         ('Content-Type', 'application/pdf'),
        #         ('Content-Length', len(pdf)),
        #     ]
        #     return request.make_response(pdf, headers=pdfhttpheaders)

        # if transaction.state == 'pending':
        #     payment_request_status = 'pending'
        #     status = 'warning'
        #     message = transaction.acquirer_id.pending_msg
        # elif transaction.state == 'done':
        #     payment_request_status = 'paid'
        #     status = 'success'
        #     message = transaction.acquirer_id.done_msg
        # else:
        #     payment_request_status = 'open'
        #     message = None
        #     status = None

        if token or not payment_request.user_has_groups('account.group_account_invoice'):
            pdf_view_right = True
            payment_request.sudo().write({'state': 'open'})#payment_request_status})
        else:
            payment_request.write({'state': 'open'})#payment_request_status})
            pdf_view_right = False

        values = {
            'payment_request': payment_request,
            'status': 'open',#status,
            'message': 'TEST',#message,
            'invoice_report': self._prepare_invoice_report_attachment(payment_request.invoice_id.id, 'account.report_invoice', token, pdf_view_right)
        }
        acquirers = env['payment.acquirer'].sudo().search([('website_published', '=', True), ('company_id', '=', payment_request.company_id.id)])
        extra_context = {
            'submit_class': 'btn btn-primary',
            'submit_txt': _('Pay Now')
        }
        values['buttons'] = {}
        values['acquirers'] = []
        for acquirer in acquirers:
            values['buttons'][acquirer.id] = acquirer.with_context(**extra_context).render(
                reference,
                payment_request.invoiced_amount,
                currency_id or payment_request.currency_id.id,
                values={
                    'return_url': '/invoice/payment/%s' % token if token else '/invoice/payment/%s' % payment_request_id,
                    'partner_id': payment_request.partner_id.id,
                    'billing_partner_id': payment_request.partner_id.id,
                })
            values['acquirers'].append(acquirer)
        values['tokens'] = env['payment.token'].search([
            ('partner_id', '=', payment_request.partner_id.id),
            ('acquirer_id', 'in', acquirers.ids)
        ])

        return request.render('account.invoice_pay', values)
