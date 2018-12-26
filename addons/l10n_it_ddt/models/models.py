# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class L10nInDdt(models.Model):
    _name = 'l10n_it_ddt'

    name = fields.Char(
        'DDT Number', default=lambda self: self.env['ir.sequence'].next_by_code('l10n.it.ddt'),
        required=True, help="Unique DDT Number")
    picking_ids = fields.One2many('stock.picking', 'l10n_it_ddt_id', string="Related picking")
    stock_move_ids = fields.One2many('stock.move', 'l10n_it_ddt_id', string="Related stock move")
