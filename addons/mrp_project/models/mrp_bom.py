# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api, fields

class MrpBom(models.Model):
    _name = 'mrp.bom'
    _inherit = 'mrp.bom'

    service_ids = fields.One2many('mrp.bom.line', 'bom_id', 'BoM Services', copy=True, domain=[('product_type', '=', 'service')])

    @api.depends('service_ids', 'bom_line_ids')
    def _compute_all_bom_line_ids(self):
        for bom in self:
            bom.all_bom_line_ids = bom.bom_line_ids + bom.service_ids
