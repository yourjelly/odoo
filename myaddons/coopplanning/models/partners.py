# -*- coding: utf-8 -*-
from odoo import models, fields, api

class Partners(models.Model):
    _name = "coopplanning.partner"
    
    name = fields.Char(required=True)
    task_ids = fields.One2many('coopplanning.task', 'worker_id')
    task_template_ids = fields.Many2many('coopplanning.task.template')
    age = fields.Integer()
    phone = fields.Char()
    email = fields.Char()
    lang = fields.Selection([('fr','Français'),('en','English'),('nl','Nederlands')])


    