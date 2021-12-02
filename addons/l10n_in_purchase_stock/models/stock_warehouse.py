# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class Stock(models.Model):
    _inherit = 'stock.warehouse'

    #Deprecated field, use multi-company instead of this field
    l10n_in_purchase_journal_id = fields.Many2one('account.journal', deprecated=True, string="Purchase Journal (Deprecated)")
