# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _

class SaleOrder(models.Model):
    _inherit = 'sale.order'

    session_id = fields.Many2one('pos.session', string='Session', readonly=True, copy=False)
