# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class MailThread(models.AbstractModel):
    _inherit = ['mail.thread']

    def _get_thread_controller_allowed_post_params(self):
        return super()._get_thread_controller_allowed_post_params() | {"rating_value"}
