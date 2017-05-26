# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, http, _
from odoo.http import request
from odoo.addons.payment.controllers.main import Payment


class SaleQuotation(Payment):

    def _get_quotation_value(self, order_sudo, transaction, token=None, **post):
        days = 0
        if order_sudo.validity_date:
            days = (fields.Date.from_string(order_sudo.validity_date) - fields.Date.from_string(fields.Date.today())).days + 1
        values = {
            'quotation': order_sudo,
            'order_valid': (not order_sudo.validity_date) or (fields.Date.today() <= order_sudo.validity_date),
            'days_valid': days,
            'action': request.env.ref('sale.action_quotations').id,
            'tx_id': transaction.id if transaction else False,
            'tx_state': transaction.state if transaction else False,
            'tx_post_msg': transaction.acquirer_id.post_msg if transaction else False,
            'need_payment': order_sudo.invoice_status == 'to invoice' and transaction.state in ['draft', 'cancel', 'error'],
            'token': token,
            'show_button_modal_cancel': True,
            'quotation_pay': False,
        }
        return values

    @http.route("/quote/report/html", type='json', auth="public", website=True)
    def html_report(self, payment_request_id=None, token=None, **kwargs):
        # the real invoice report (displayed in HTML format)
        access_token = token if token != payment_request_id else None
        payment_request = self._get_invoice_payment_request(payment_request_id, access_token, **kwargs)
        return request.env.ref('sale.action_report_saleorder').sudo().render_qweb_html([payment_request.order_id.id])[0]

    @http.route("/quote/<int:payment_request_id>", type='http', auth="user", website=True)
    def view_user(self, *args, **kwargs):
        return self.view(*args, **kwargs)

    @http.route("/quote/<token>", type='http', auth="public", website=True)
    def view(self, payment_request_id=None, pdf=None, token=None, message=False, **post):
        # use sudo to allow accessing/viewing orders for public user
        # only if he knows the private token
        payment_request = self._get_invoice_payment_request(payment_request_id, token, **post)

        if not payment_request or (payment_request and not payment_request.order_id):
            return request.render('payment.404')

        # Token or not, sudo the order, since portal user has not access on
        # taxes, required to compute the total_amout of SO.
        order_sudo = payment_request.order_id.sudo()
        if pdf:
            return self._print_invoice_pdf(payment_request.order_id.id, 'sale.action_report_saleorder')

        transaction_id = request.session.get('quote_%s_transaction_id' % order_sudo.id)
        if not transaction_id:
            transaction = request.env['payment.transaction'].sudo().search([('reference', '=', order_sudo.name)])
        else:
            transaction = request.env['payment.transaction'].sudo().browse(transaction_id)

        values = self._get_quotation_value(order_sudo, transaction, **post)
        values['message'] = message and int(message) or False,
        values['payment_request'] = payment_request

        if order_sudo:
            render_values = {
                'return_url': '/quote/%s' % token if token else '/quote/%s' % payment_request_id,
                'type': 'form',
                'alias_usage': _('If we store your payment information on our server, subscription payments will be made automatically.'),
                'partner_id': order_sudo.partner_id.id,
            }

            values.update(order_sudo.with_context(submit_class="btn btn-primary", submit_txt=_('Pay & Confirm'))._prepare_payment_acquirer(values=render_values))
            values['save_option'] = False

        return request.render('sale.so_quotation', values)
