# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _

class ProjectProjectStage(models.Model):
    _name = 'project.project.stage'
    _description = 'Project Stage'
    _order = 'sequence, id'

    active = fields.Boolean(default=True)
    sequence = fields.Integer(default=50)
    name = fields.Char(required=True, translate=True)
    mail_template_id = fields.Many2one('mail.template', string='Email Template', domain=[('model', '=', 'project.project')],
        help="If set, an email will be automatically sent to the customer when the project reaches this stage.")
    fold = fields.Boolean('Folded in Kanban',
        help="If enabled, this stage will be displayed as folded in the Kanban view of your projects. Projects in a folded stage are considered as closed.")

    def copy(self, default=None):
        default = dict(default or {})
        if not default.get('name'):
            default['name'] = _("%s (copy)") % (self.name)
        return super().copy(default)

    def unlink_wizard(self, stage_view=False):
        wizard = self.with_context(active_test=False).env['project.project.stage.delete.wizard'].create({
            'stage_ids': self.ids
        })

        context = dict(self.env.context)
        context['stage_view'] = stage_view
        return {
            'name': _('Delete Project Stage'),
            'view_mode': 'form',
            'res_model': 'project.project.stage.delete.wizard',
            'views': [(self.env.ref('project.view_project_project_stage_delete_wizard').id, 'form')],
            'type': 'ir.actions.act_window',
            'res_id': wizard.id,
            'target': 'new',
            'context': context,
        }

    def write(self, vals):
        if 'active' in vals and not vals['active']:
            self.env['project.project'].search([('stage_id', 'in', self.ids)]).write({'active': False})
        return super().write(vals)

    def toggle_active(self):
        res = super().toggle_active()
        stage_active = self.filtered('active')
        inactive_projects = self.env['project.project'].with_context(active_test=False).search(
            [('active', '=', False), ('stage_id', 'in', stage_active.ids)], limit=1)
        if stage_active and inactive_projects:
            wizard = self.env['project.project.stage.delete.wizard'].create({
                'stage_ids': stage_active.ids,
            })

            return {
                'name': _('Unarchive Projects'),
                'view_mode': 'form',
                'res_model': 'project.project.stage.delete.wizard',
                'views': [(self.env.ref('project.view_project_project_stage_unarchive_wizard').id, 'form')],
                'type': 'ir.actions.act_window',
                'res_id': wizard.id,
                'target': 'new',
            }
        return res
