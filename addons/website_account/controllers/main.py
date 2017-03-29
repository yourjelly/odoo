# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import logging


from odoo import http, _
from odoo.exceptions import AccessError
from odoo.http import request

from odoo.addons.website_portal.controllers.main import website_account

_logger = logging.getLogger(__name__)


class website_account(website_account):

    def _prepare_portal_layout_values(self):
        values = super(website_account, self)._prepare_portal_layout_values()
        partner = request.env.user.partner_id

        values['invoice_count'] = request.env['account.invoice'].search_count([
            ('type', 'in', ['out_invoice', 'out_refund']),
            ('message_partner_ids', 'child_of', [partner.commercial_partner_id.id]),
            ('state', 'in', ['open', 'paid', 'cancel'])
        ])

        return values

    @http.route(['/my/invoices', '/my/invoices/page/<int:page>'], type='http', auth="user", website=True)
    def portal_my_invoices(self, page=1, date_begin=None, date_end=None, sortby=None, **kw):
        values = self._prepare_portal_layout_values()
        partner = request.env.user.partner_id
        AccountInvoice = request.env['account.invoice']

        domain = [
            ('type', 'in', ['out_invoice', 'out_refund']),
            ('message_partner_ids', 'child_of', [partner.commercial_partner_id.id]),
            ('state', 'in', ['open', 'paid', 'cancelled'])
        ]

        searchbar_sortings = {
            'date': {'label': _('Invoice Date'), 'order': 'date_invoice desc'},
            'duedate': {'label': _('Due Date'), 'order': 'date_due desc'},
            'name': {'label': _('Reference'), 'order': 'name desc'},
            'state': {'label': _('Status'), 'order': 'state'},
        }
        # default sort by order
        if not sortby:
            sortby = 'date'
        order = searchbar_sortings[sortby]['order']

        archive_groups = self._get_archive_groups('account.invoice', domain)
        if date_begin and date_end:
            domain += [('create_date', '>', date_begin), ('create_date', '<=', date_end)]

        # count for pager
        invoice_count = AccountInvoice.search_count(domain)
        # pager
        pager = request.website.pager(
            url="/my/invoices",
            url_args={'date_begin': date_begin, 'date_end': date_end, 'sortby': sortby},
            total=invoice_count,
            page=page,
            step=self._items_per_page
        )
        # content according to pager and archive selected
        invoices = AccountInvoice.search(domain, order=order, limit=self._items_per_page, offset=pager['offset'])
        values.update({
            'date': date_begin,
            'invoices': invoices,
            'page_name': 'invoice',
            'pager': pager,
            'archive_groups': archive_groups,
            'default_url': '/my/invoices',
            'searchbar_sortings': searchbar_sortings,
            'sortby': sortby,
        })
        return request.render("website_account.portal_my_invoices", values)

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
        transaction = payment_request.payment_transaction_id
        if pdf and token:
            # print report as sudo, since it require access to taxes, payment term, ... and portal
            # does not have those access rights.
            pdf = env['report'].sudo().get_pdf([payment_request.invoice_id.id], 'account.report_invoice')

            pdfhttpheaders = [
                ('Content-Type', 'application/pdf'),
                ('Content-Length', len(pdf)),
            ]
            return request.make_response(pdf, headers=pdfhttpheaders)

        if transaction.state == 'pending':
            payment_request_status = 'pending'
            status = 'warning'
            message = transaction.acquirer_id.pending_msg
        elif transaction.state == 'done':
            payment_request_status = 'paid'
            status = 'success'
            message = transaction.acquirer_id.done_msg
        else:
            payment_request_status = 'open'
            message = None
            status = None

        if token or not payment_request.user_has_groups('account.group_account_invoice'):
            pdf_view_right = True
            payment_request.sudo().write({'state': payment_request_status})
        else:
            payment_request.write({'state': payment_request_status})
            pdf_view_right = False

        values = {
            'payment_request': payment_request,
            'status': status,
            'message': message,
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

        return request.render('website_account.invoice_pay', values)

    @http.route(['/invoice/payment/transaction_token/confirm'], type='json', auth="public", website=True)
    def payment_transaction_token_confirm(self, tx_id, **kwargs):
        tx = request.env['payment.transaction'].sudo().browse(int(tx_id))
        if (tx and tx.payment_token_id and
                tx.partner_id == tx.payment_request_id.partner_id):
            try:
                s2s_result = tx.s2s_do_transaction()
                valid_state = 'authorized' if tx.acquirer_id.auto_confirm == 'authorize' else 'done'
                if not s2s_result or tx.state != valid_state:
                    return dict(success=False, error=_("Payment transaction failed (%s)") % tx.state_message)
                else:
                    return dict(success=True, url="/invoice/payment/%s" % tx.payment_request_id.id)
            except Exception as e:
                _logger.warning(_("Payment transaction (%s) failed : <%s>") % (tx.id, str(e)))
                return dict(success=False, error=_("Payment transaction failed (Contact Administrator)"))
        return dict(success=False, error='Tx missmatch')

    @http.route(['/invoice/payment/transaction_token'], type='http', methods=['POST'], auth="public", website=True)
    def payment_transaction_token(self, tx_id, **kwargs):
        tx = request.env['payment.transaction'].sudo().browse(int(tx_id))
        if (tx and tx.payment_token_id and tx.partner_id == tx.payment_request_id.partner_id):
            return request.render("website_account.payment_token_form_confirm", dict(tx=tx, payment_request=tx.payment_request_id))
        else:
            return request.redirect("/invoice/payment/%s" % tx.payment_request_id.id, "?error=no_token_or_missmatch_tx")

    @http.route("/invoice/payment/transaction/<int:acquirer_id>", type='json', auth="public", website=True)
    def payment_transaction(self, acquirer_id, tx_type='form', token=None, **kwargs):
        """ Json method that creates a payment.transaction, used to create a
        transaction when the user clicks on 'pay now' button. After having
        created the transaction, the event continues and the user is redirected
        to the acquirer website.

        :param int acquirer_id: id of a payment.acquirer record. If not set the
                                user is redirected to the checkout page
        """
        # In case the route is called directly from the JS (as done in Stripe payment method)
        payment_request_id = kwargs.get('payment_request_id')
        access_token = kwargs.get('access_token') if kwargs.get('access_token') != kwargs.get('payment_request_id') else None
        PaymentTransaction = request.env['payment.transaction'].sudo()
        invoice_payment, currency_id = self._get_invoice_payment_request(payment_request_id, access_token, None)

        if not invoice_payment or acquirer_id is None:
            return request.redirect("/invoice/payment/%s" % access_token if access_token else '/invoice/payment/%s' % payment_request_id)

        # find an already existing transaction
        Transaction = PaymentTransaction.search([
            ('reference', '=', invoice_payment.reference),
            ('payment_request_id', '=', payment_request_id)
        ])
        if Transaction:
            if Transaction != invoice_payment.payment_transaction_id or Transaction.state in ['error', 'cancel'] or Transaction.acquirer_id.id != acquirer_id:
                Transaction = False
            elif token and Transaction.payment_token_id and token != Transaction.payment_token_id.id:
                # new or distinct token
                Transaction = False
            elif Transaction.state == 'draft':
                Transaction.write({
                    'amount': invoice_payment.invoiced_amount,
                })
        if not Transaction:
            Transaction = PaymentTransaction.create({
                'acquirer_id': acquirer_id,
                'type': tx_type,
                'payment_request_id': invoice_payment.id,
                'amount': invoice_payment.invoiced_amount,
                'currency_id': invoice_payment.currency_id.id,
                'partner_id': invoice_payment.partner_id.id,
                'reference': PaymentTransaction.get_next_reference(invoice_payment.reference),
                'callback_model_id': request.env['ir.model'].sudo().search([('model', '=', invoice_payment._name)], limit=1).id,
                'callback_res_id': invoice_payment.id,
            })
            if token and request.env['payment.token'].sudo().browse(int(token)).partner_id == invoice_payment.partner_id:
                Transaction.payment_token_id = token
            request.session['invoice_tx_id'] = Transaction.id

        # update
        invoice = invoice_payment.invoice_id
        if access_token or not invoice_payment.user_has_groups('account.group_account_invoice'):
            invoice_payment.sudo().payment_transaction_id = Transaction
            invoice.sudo().write({
                'payment_acquirer_id': acquirer_id,
                'payment_tx_id': Transaction.id
            })
        else:
            invoice_payment.payment_transaction_id = Transaction
            invoice.write({
                'payment_acquirer_id': acquirer_id,
                'payment_tx_id': Transaction.id
            })
        if token:
            return request.env.ref('website_account.payment_token_form').render(dict(tx=Transaction), engine='ir.qweb')

        return Transaction.acquirer_id.with_context(submit_class='btn btn-primary', submit_txt=_('Pay Now')).sudo().render(
            Transaction.reference,
            invoice_payment.invoiced_amount,
            invoice_payment.currency_id.id,
            values={
                'return_url': '/invoice/payment/%s' % access_token if access_token else '/invoice/payment/%s' % payment_request_id,
                'partner_id': invoice_payment.partner_id.id,
                'billing_partner_id': invoice_payment.partner_id.id,
            })

    def details_form_validate(self, data):
        error, error_message = super(website_account, self).details_form_validate(data)
        # prevent VAT/name change if invoices exist
        partner = request.env['res.users'].browse(request.uid).partner_id
        invoices = request.env['account.invoice'].sudo().search_count([('partner_id', '=', partner.id), ('state', 'not in', ['draft', 'cancel'])])
        if invoices:
            if (data.get('vat', partner.vat) or False) != partner.vat:
                error['vat'] = 'error'
                error_message.append(_('Changing VAT number is not allowed once invoices have been issued for your account. Please contact us directly for this operation.'))
            if data.get('name', partner.name) != partner.name:
                error['name'] = 'error'
                error_message.append(_('Changing your name is not allowed once invoices have been issued for your account. Please contact us directly for this operation.'))
        return error, error_message
