# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _
from odoo.exceptions import UserError


class InvoiceFinancingRequest(models.TransientModel):
    _name = "account.invoice.financing"

    invoice_ids = fields.Many2many('account.invoice', string="Invoices ready for financing")
    ignored_invoice_ids = fields.Many2many('account.invoice', string="Invoices not allowed for financing", readonly=True)

    @api.model
    def default_get(self, fields):
        """ Default get for valid invoices and ignored invoices"""
        result = super(InvoiceFinancingRequest, self).default_get(fields)
        active_ids = self._context.get('active_ids', [])
        invoices = self.env['account.invoice'].browse(active_ids)
        ignored_invoices = invoices.filtered(lambda i: i.state != 'open' or i.partner_id.company_type != 'company')
        open_invoices = invoices - ignored_invoices

        if not open_invoices:
            raise UserError(_("No any open invoices for financing. Only Open and Company invoice allowed"))
        result['invoice_ids'] = list(open_invoices.ids)
        result['ignored_invoice_ids'] = list(ignored_invoices.ids)
        return result

    @api.model
    def send_for_financing(self):
        # TODO: Create FO (Factoring with invoices) and redirect to record
        pass
