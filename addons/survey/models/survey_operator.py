# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class SurveyOperator(models.Model):
    """ used for a set of question dependency rule to a particular question """

    _name = 'survey.operator'

    name = fields.Char(required=True)
    code = fields.Char(translate=True, required=True)

    _sql_constraints = [
        ('name_uniq', 'unique(name, code)', 'Operator code and name must be unique !'),
    ]

