# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError
from odoo.tools import get_diff


class ResetMailTemplateBodyWizard(models.TransientModel):
    _name = "reset.mail.template.body.wizard"
    _description = "Reset Mail Template Body Wizard"

    template_id = fields.Many2one('mail.template', string='Template')
    template_name = fields.Char(related='template_id.name')
    has_diff = fields.Boolean(compute='_compute_body_diff')
    body_diff = fields.Html(string='Body Html Diff', readonly=True,
                            compute='_compute_body_diff', sanitize_tags=False)

    @api.model
    def default_get(self, fields):
        template_id = (self._context.get('active_model') == 'mail.template' and
                       self._context.get('active_id', False))
        if not template_id:
            raise ValidationError(_("Please choose template to compare."))

        result = super().default_get(fields)
        result['template_id'] = template_id
        return result

    @api.depends('template_id')
    def _compute_body_diff(self):
        for view in self.with_context(lang=None):
            diff_to = view.template_id.body_html_prev
            body_html = view.template_id.body_html

            view.body_diff = get_diff(
                (body_html, _("Current Body Html")),
                (diff_to, _("Previous Body")),
            )
            view.has_diff = body_html != diff_to

    def reset_view_button(self):
        self.ensure_one()
        self.template_id.write({'body_html': self.template_id.body_html_prev})
        return {'type': 'ir.actions.act_window_close'}
