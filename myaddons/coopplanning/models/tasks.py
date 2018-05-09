# -*- coding: utf-8 -*-
from odoo import models, fields, api

class Task(models.Model):
    _name = 'coopplanning.task'

    name = fields.Char()
    worker_id = fields.Many2one('coopplanning.partner')
    start_time = fields.Datetime()
    end_time = fields.Datetime()
    task_template_id = fields.Many2one('coopplanning.task.template')
    task_type_id = fields.Many2one('coopplanning.task.type', string="Task Type")


