# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models

class MilestoneTransferTask(models.TransientModel):
    _name = 'milestone.transfer.task.wizard'
    _description = 'Milestone Transfer Task Wizard'

    def _get_default_milestone_id(self):
        return self.env.context.get('default_project_id') or self.env.context.get('active_id')

    project_id = fields.Many2one(related="milestone_id.project_id", required=True)
    milestone_id = fields.Many2one('project.milestone', required=True, default=_get_default_milestone_id, ondelete='cascade')

    def action_transfer_Task(self):
        for wizard in self:
            next_ms = wizard.milestone_id.next_milestone_id
            if wizard.milestone_id.id != next_ms.id and next_ms and next_ms.project_id == wizard.project_id:
                non_folded_task = wizard.milestone_id.task_ids.filtered(lambda task: not task.stage_id.fold)
                non_folded_task.milestone_id = next_ms.id
            else:
                wizard.milestone_id.is_folded_task = False
                wizard.milestone_id.is_reached = True
