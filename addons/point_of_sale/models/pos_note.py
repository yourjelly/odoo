# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class PosNote(models.Model):
    _name = 'pos.note'
    _description = 'PoS Note'
    _inherit = ['pos.load.mixin']

    name = fields.Char(required=True)
    sequence = fields.Integer('Sequence', default=1)
    color = fields.Integer(string='Color')

    _sql_constraints = [('name_unique', 'unique (name)', "A note with this name already exists")]

    @api.model
    def _load_pos_data_fields(self, config_id):
        return ['name', 'color']
