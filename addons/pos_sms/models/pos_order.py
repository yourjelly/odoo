# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class PosOrder(models.Model):
    _inherit = 'pos.order'

    def action_sent_message_on_sms(self, name, partner, ticket_image):
        """ Send message on sms if sms is enabled and partner has mobile number or number is provided."""
        if not self or not self.config_id.module_pos_sms or not self.config_id.sms_receipt_template_id or not partner.get('sms'):
            return
        self.ensure_one()
        sms_composer = self.env['sms.composer'].with_context({'active_id': self.id}).create(
            {
                'composition_mode': 'numbers',
                'numbers': partner['sms'],
                'template_id': self.config_id.sms_receipt_template_id.id,
                'res_model': 'pos.order'
            }
        )
        sms_composer.action_send_sms()
