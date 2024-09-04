#!/usr/bin/env python3

from odoo import api, fields, models, _
from odoo.exceptions import UserError

class AccountMove(models.Model):
    _inherit = 'account.move'

    account_peppol_response_ids = fields.One2many('account_peppol.invoice_response', 'move_id')

    def action_peppol_invoice_response_accept(self):
        """ Create and send a peppol invoice response for the current move """
        self.ensure_one()
        invoice_response = self.env['account_peppol.invoice_response'].create({
            'direction': 'outgoing',
            'date': fields.date.today(),
            'move_id': self.id,
            'code': 'AP',
        })
        # try:
        invoice_response.send()
        # except somekindofproxyerror
        # post error message

        return invoice_response

    def action_peppol_invoice_response_cancel(self):
        """ Create and send a peppol invoice response for the current move """
        self.ensure_one()
        invoice_response = self.env['account_peppol.invoice_response'].create({
            'direction': 'outgoing',
            'date': fields.date.today(),
            'move_id': self.id,
            'code': 'RE',
        })
        # try:
        invoice_response.send()
        # except somekindofproxyerror
        # post error message

        return invoice_response

    def button_cancel(self):
        if self.company_id.account_peppol_proxy_state == 'active' or True:  # HACK
            self.with_context(
                mail_activity_quick_update=True,
                account_peppol_invoice_response=True
            ).activity_schedule(
                'account_peppol_invoice_response.activity_type_invoice_response_cancel',
            )
        return super().button_cancel()

    def action_post(self):
        # EXTEND account
        """ Post a mail activity inviting the user to send a 'acceptance' peppol invoice response"""
        # TODO write sufficient condition
        # a) company is registered for peppol (done)
        # b) partner can receive peppol invoice responses
        if self.company_id.account_peppol_proxy_state == 'active' or True:  # HACK
            self.with_context(mail_activity_quick_update=True).activity_schedule(
                'account_peppol_invoice_response.activity_type_invoice_response_confirm',
            )
        return super().action_post()
