from odoo import fields, models

class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    pos_customer_display_type = fields.Selection(related="pos_config_id.customer_display_type", readonly=False, required=True)
    pos_customer_display_bg_img = fields.Image(related='pos_config_id.customer_display_bg_img', readonly=False)
    pos_customer_display_bg_img_name = fields.Char(related='pos_config_id.customer_display_bg_img_name', readonly=False)
