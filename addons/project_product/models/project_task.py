# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import ast

from odoo import fields, models, _


class ProjectTask(models.Model):
    _name = 'project.task'
    _inherit = 'project.task'

    cost_ids = fields.One2many('project.product', 'task_id') 