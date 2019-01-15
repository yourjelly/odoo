# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class SaleOrder(models.Model):
    _inherit = "sale.order"

    # @api.depends('ddt_ids')
    # def _compute_sale_order(self):


    ddt_ids = fields.Many2many('l10n.it.ddt', string="DDT")
