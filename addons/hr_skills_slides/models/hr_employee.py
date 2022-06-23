# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, models

class HREmployee(models.Model):
    _inherit = 'hr.employee'

    def action_open_slides_wizard(self):
        self.ensure_one()

        return {
            'type': 'ir.actions.act_window',
            'name': _('Courses'),
            'res_model': 'slide.channel.partner',
            'domain': [
                ('partner_id', 'in', self.user_partner_id.ids),
            ],
            'view_mode': 'list,gantt',
            'context': {
                'default_partner_id': self.user_partner_id.id,
            }
        }
