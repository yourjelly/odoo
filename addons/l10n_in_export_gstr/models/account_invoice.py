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
    gst_import_type = fields.Selection([('import', 'Import'),
                                         ('sez_import', 'Import from SEZ')], string="GST Invoice Type")

class AccountInvoiceLine(models.Model):

    _inherit = "account.invoice.line"

    gst_itc_type_id = fields.Many2one('gst.itc.type', string="ITC Type", help="Input Tax Credit Under GST. If type not selected then it's consider as Ineligible")
    product_type = fields.Selection(related="product_id.type", string="Product type")
