# Part of Odoo. See LICENSE file for full copyright and licensing details.

from markupsafe import Markup, escape

from odoo import fields, models, _
from odoo.tools.misc import clean_context


class Survey(models.Model):
    _inherit = "survey.survey"

    def _notify_get_recipients_groups(self, message, model_description, msg_vals=None):
        breakpoint()
        groups = super()._notify_get_recipients_groups(message, model_description, msg_vals=msg_vals)
        customer_group = next(group for group in groups if group[0] == 'customer')
        customer_group[2]['active'] = True
        customer_group[2]['has_button_access'] = True
        access_opt = customer_group[2].setdefault('button_access', {'title': _('Start the written interview')})
        access_opt['url'] = self.get_start_url()

        return groups