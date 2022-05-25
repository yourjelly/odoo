# -*- coding: utf-8 -*-
from odoo import fields, models
from odoo.tools.translate import html_translate


class TestModel1(models.Model):
    _name = 'test.model.1'
    _description = 'Translation Test 1'

    name = fields.Char('Name', translate=True)
    html = fields.Html('HTML', translate=html_translate)

class TestModel2(models.Model):
    _name = 'test.model.2'
    _description = 'Translation Test 1'

    parent_id = fields.Many2one('test.model.1', string='Parent Model')
    name = fields.Char('Name Related', related='parent_id.name', readonly=False)
    html = fields.Html('HTML Related', related='parent_id.html', readonly=False)
