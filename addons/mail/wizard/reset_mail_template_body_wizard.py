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
    reset_mode = fields.Selection([
        ('soft', 'Restore previous version (soft reset).'),
        ('hard', 'Reset to file version (hard reset).'),
        ('other_template', 'Reset to another template.')],
        string='Reset Mode', default='soft', required=True)
    compare_template_id = fields.Many2one('mail.template', string='Compare To Template')
    body_to_compare = fields.Text('Body Html To Compare To', compute='_compute_body_diff')

    @api.model
    def default_get(self, fields):
        template_ids = (self._context.get('active_model') == 'mail.template' and
                        self._context.get('active_ids') or [])
        if len(template_ids) > 2:
            raise ValidationError(_("Can't compare more than two Templates."))

        result = super().default_get(fields)
        result['template_id'] = template_ids and template_ids[0]
        if len(template_ids) == 2:
            result['compare_template_id'] = template_ids[1]
        return result

    @api.depends('reset_mode', 'template_id', 'compare_template_id')
    def _compute_body_diff(self):
        for view in self:
            diff_to = view.template_id.body_html_prev
            view.body_to_compare = diff_to

            body_html = view.template_id.with_context(lang=None).body_html

            view.body_diff = get_diff(
                (body_html, _("Current Body Html")),
                (diff_to, _("Previous Body")),
            )
            view.has_diff = body_html != diff_to

    def reset_view_button(self):
        self.ensure_one()
        self.template_id.write({'body_html': str(self.template_id.body_html_prev)})
        return {'type': 'ir.actions.act_window_close'}
