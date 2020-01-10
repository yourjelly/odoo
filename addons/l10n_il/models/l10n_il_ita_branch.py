# -*- coding: utf-8 -*-

from odoo import fields, models


class ITABranch(models.Model):
    _name = 'l10n.il.ita.branch'

    name = fields.Char(string='ITA Branch')
    code = fields.Char(string='ITA Branch Code')

    _sql_constraints = [('code_name_uniq', 'unique (code,name)', 'The code of the ITA Branch must be unique!')]
