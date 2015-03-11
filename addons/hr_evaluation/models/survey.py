# -*- coding: utf-8 -*-
from openerp import fields, models


class SurveyUserInput(models.Model):
    _inherit = "survey.user_input"

    evaluation_id = fields.Many2one('hr_evaluation.evaluation', string='Appraisal')
