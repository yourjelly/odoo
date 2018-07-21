# coding: utf-8
from odoo import api, fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    def website_install_theme(self):
        self.env['website']._force_session_website(self.website_id.id)
        return {
            'type': 'ir.actions.act_url',
            'url': '/web#action=website_theme_install.theme_install_kanban_action',
            'target': 'self',
        }
