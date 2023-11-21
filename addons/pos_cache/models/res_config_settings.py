from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    pos_use_cache = fields.Boolean(related='pos_config_id.use_cache', readonly=False)
    point_of_sale_models_to_cache = fields.Many2many(related='company_id.point_of_sale_models_to_cache', readonly=False)
