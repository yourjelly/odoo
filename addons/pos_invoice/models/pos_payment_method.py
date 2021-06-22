# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class PoSPaymentMethod(models.Model):
    _inherit = "pos.payment.method"

    bank_journal_id = fields.Many2one(
        "account.journal",
        string="Bank Journal",
        domain=[("type", "=", "bank")],
        ondelete="restrict",
        help="Bank journal related to this payment method. Used when paying invoices.",
    )
