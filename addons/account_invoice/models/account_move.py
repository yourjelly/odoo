# -*- coding: utf-8 -*-
from odoo import api, fields, models


class AccountMove(models.Model):
    _inherit = 'account.move'

    invoice_id = fields.Many2one(
        comodel_name='account.invoice',
        copy=False, check_company=True)


class AccountMoveLine(models.Model):
    _inherit = 'account.move.line'

    invoice_line_id = fields.Many2one(
        comodel_name='account.invoice.line',
        copy=False, readonly=True, ondelete='cascade')
    invoice_tax_line_id = fields.Many2one(
        comodel_name='account.invoice.tax',
        copy=False, readonly=True, ondelete='cascade')
    invoice_pay_line_id = fields.Many2one(
        comodel_name='account.invoice.payment',
        copy=False, readonly=True, ondelete='cascade')
