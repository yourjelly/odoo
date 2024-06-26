# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    equipment_ids = fields.One2many(comodel_name='maintenance.equipment', inverse_name='customer_id')
    equipment_count = fields.Integer(compute='_compute_equipment_count')

    @api.depends('equipment_ids')
    def _compute_equipment_count(self):
        for partner in self:
            partner.equipment_count = len(partner.equipment_ids)
