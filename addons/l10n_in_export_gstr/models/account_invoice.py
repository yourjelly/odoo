# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class AccountInvoice(models.Model):

    _inherit = "account.invoice"

    refund_reason_id = fields.Many2one("account.invoice.refund.reason", string="Refund Reason")
    gst_invoice_type = fields.Selection([('r', 'Regular'),
                                         ('dewp', 'Deemed Exports with payment'),
                                         ('dewop', 'Deemed Exports without payment'),
                                         ('sewp', 'SEZ Exports with payment'),
                                         ('sewop', 'SEZ exports without payment')], default="r", string="GST Invoice Type")
    gst_import_type = fields.Selection([('import', 'Import'),
                                         ('sez_import', 'Import from SEZ')], string="Import Type")

class AccountInvoiceLine(models.Model):

    _inherit = "account.invoice.line"

    is_eligible_for_itc = fields.Boolean(string="Is eligible for ITC",  help="Check this box if this product is eligible for ITC(Input Tax Credit) under GST")
    itc_percentage = fields.Float(string="ITC percentage", default=100,  help="Enter percentage in case of partly eligible for ITC(Input Tax Credit) under GST.")

    @api.onchange('product_id')
    def _onchange_product_id(self):
        res = super(AccountInvoiceLine, self)._onchange_product_id()
        if self.product_id:
            self.is_eligible_for_itc = self.product_id.is_eligible_for_itc
