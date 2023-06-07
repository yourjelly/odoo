# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class ProjectShareWizard(models.TransientModel):
    _name = 'project.share.wizard'
    _inherit = ['portal.share', 'mail.composer.mixin']
    _description = 'Project Sharing'

    @api.model
    def default_get(self, fields):
        result = super().default_get(fields)
        if not result.get('access_mode'):
            result.update(
                access_mode='read',
                display_access_mode=True,
            )
        return result

    @api.model
    def _selection_target_model(self):
        project_model = self.env['ir.model']._get('project.project')
        return [(project_model.model, project_model.name)]

    access_mode = fields.Selection([('read', 'Read-only'), ('edit', 'Edit')])
    send_email = fields.Boolean()
    display_access_mode = fields.Boolean()
    emails = fields.Text(string='Additional emails')

    @api.depends('template_id')
    def _compute_body(self):
        for share_wizard in self:
            langs = set(share_wizard.partner_ids.mapped('lang')) - {False}
            if len(langs) == 1:
                share_wizard = share_wizard.with_context(lang=langs.pop())
            super(ProjectShareWizard, share_wizard)._compute_body()


    @api.depends('template_id')
    def _compute_subject(self):
        for share_wizard in self:
            if share_wizard.subject:
                continue
            else:
                share_wizard.subject = _(f"Participate to {share_wizard.resource_ref.name} project.")

    @api.depends('res_model', 'res_id')
    def _compute_resource_ref(self):
        for wizard in self:
            if wizard.res_model and wizard.res_model == 'project.project':
                wizard.resource_ref = '%s,%s' % (wizard.res_model, wizard.res_id or 0)
            else:
                wizard.resource_ref = None

    def action_send_mail(self):
        self.ensure_one()
        if self.access_mode == 'edit':
            portal_partners = self.partner_ids.filtered('user_ids')
            self.resource_ref._add_collaborators(self.partner_ids)
            self._send_public_link(portal_partners)
            self._send_signup_link(partners=self.partner_ids - portal_partners)
            self.resource_ref.message_subscribe(partner_ids=self.partner_ids.ids)
            return {'type': 'ir.actions.act_window_close'}
        return super().action_send_mail()
