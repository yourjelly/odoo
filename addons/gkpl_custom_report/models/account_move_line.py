# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _

class AccountMoveLine(models.Model):
    _name = 'account.move.line'
    _inherit='account.move.line'

    discounted_price_invoice = fields.Float(related="sale_line_ids.price_excluding_discount")