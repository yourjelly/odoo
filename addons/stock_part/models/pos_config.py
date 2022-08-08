from odoo import fields, models


class PosConfig(models.Model):
    _inherit = "pos.config"

    location_id = fields.Integer(related="picking_type_id.default_location_src_id.id")
    block_when_no_stock = fields.Boolean()
