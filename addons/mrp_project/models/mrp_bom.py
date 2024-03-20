# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api, fields

class MrpBom(models.Model):
    _name = 'mrp.bom'
    _inherit = 'mrp.bom'

    service_ids = fields.One2many('mrp.bom.line', 'bom_id', 'BoM Services', copy=True, compute='_compute_service_ids')

    @api.depends('bom_line_ids', 'bom_line_ids.product_type')
    def _compute_service_ids(self):
        for bom in self:
            bom.service_ids = bom.bom_line_ids.filtered(lambda line: line.product_type == 'service')
