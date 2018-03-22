# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _


class AccountInvoice(models.Model):

    _inherit = "account.invoice"

    refund_reason_id = fields.Many2one("account.invoice.refund.reason", string="Refund Reason")
    gst_invoice_type = fields.Selection([('r', 'Regular'),
                                         ('dewp', 'Deemed Exports with payment'),
                                         ('dewop', 'Deemed Exports without payment'),
                                         ('sewp', 'SEZ Exports with payment'),
                                         ('sewop', 'SEZ exports without payment')], default="r", string="GST Invoice Type")
