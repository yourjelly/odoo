# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models


class graph(models.Model):

    _inherit = 'product.template'

    city = fields.Many2one('res.city', string="City")
    graph = fields.Char(string="Graph")
