import secrets

from odoo import fields, models


class PosConfig(models.Model):
    _inherit = 'pos.config'

    def _get_customer_display_types(self):
        return [('none', 'None'), ('local', 'The same device'), ('remote', 'Another device'), ('proxy', 'An IOT-connected screen')]

    customer_display_type = fields.Selection(selection=lambda self: self._get_customer_display_types(), string='Customer Facing Display', help="Show checkout to customers.", default='local')
    customer_display_bg_img = fields.Image(string='Background Image', max_width=1920, max_height=1920)
    customer_display_bg_img_name = fields.Char(string='Background Image Name')

    def update_customer_display(self, order, access_token):
        self.ensure_one()
        if not access_token or not secrets.compare_digest(self.access_token, access_token):
            return
        self._notify("UPDATE_CUSTOMER_DISPLAY", order)

    def _get_customer_display_data(self):
        self.ensure_one()
        return {
            'config_id': self.id,
            'access_token': self.access_token,
            'type': self.customer_display_type,
            'has_bg_img': bool(self.customer_display_bg_img),
            'company_id': self.company_id.id,
            **({'proxy_ip': self.proxy_ip} if self.customer_display_type == 'proxy' else {}),
        }
