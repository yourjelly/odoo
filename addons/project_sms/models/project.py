# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ProjectTaskType(models.Model):
    _inherit = "project.task.type"

    sms_template_id = fields.Many2one('sms.template', string="SMS Template",
        domain=[('model', '=', 'project.task')], help="Template used to render SMS reminder content.")

class ProjectTask(models.Model):
    _inherit = "project.task"

    def send_task_sms(self):
        for task in self.filtered(lambda t: t.stage_id and t.stage_id.sms_template_id and t.partner_id):
            task._message_sms_with_template(template=task.stage_id.sms_template_id, partner_ids=task.partner_id.ids)

    @api.model_create_multi
    def create(self, vals_list):
        tasks = super().create(vals_list)
        tasks.send_task_sms()
        return tasks

    def write(self, vals):
        res = super().write(vals)
        if 'stage_id' in vals:
            self.send_task_sms()
        return res

class ProjectProjectStage(models.Model):
    _inherit = 'project.project.stage'

    sms_template_id = fields.Many2one('sms.template', string="SMS Template",
        domain=[('model', '=', 'project.project')], help="Template used to render SMS reminder content.")

class ProjectProject(models.Model):
    _inherit = "project.project"

    def send_project_sms(self):
        for project in self.filtered(lambda p: p.stage_id and p.stage_id.sms_template_id and p.partner_id):
            project._message_sms_with_template(template=project.stage_id.sms_template_id, partner_ids=project.partner_id.ids)

    @api.model_create_multi
    def create(self, vals_list):
        projects = super().create(vals_list)
        projects.send_project_sms()
        return projects

    def write(self, vals):
        res = super().write(vals)
        if 'stage_id' in vals:
            self.send_project_sms()
        return res
