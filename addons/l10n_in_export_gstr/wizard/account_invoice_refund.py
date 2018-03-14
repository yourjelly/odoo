# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields


class AccountInvoiceRefund(models.TransientModel):
    """Credit Notes"""

    _inherit = "account.invoice.refund"

    refund_reason_id = fields.Many2one('account.invoice.refund.reason', string="Select Reason")

    @api.multi
    def invoice_refund(self):
        result = super(AccountInvoiceRefund, self).invoice_refund()
        if isinstance(result, dict) and result.get('domain'):
            invoices = self.env['account.invoice'].search(result['domain'])
            for refund in self:
                invoices.write({"refund_reason_id": refund.refund_reason_id.id})
        return result
