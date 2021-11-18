# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models
from odoo.tools import format_datetime, format_date


class IrActionsReport(models.Model):
    _inherit = 'ir.actions.report'

    def _get_rendering_context(self, docids, data):
        data = super()._get_rendering_context(docids, data)

        if self.report_name == 'survey.survey_page_print_report':
            docs = data.get('docs')
            if docs._name == 'survey.survey':
                survey = docs
                answer = self.env['survey.user_input']
            else:
                survey = docs.survey_id
                answer = docs
            data.update({
                'survey': survey,
                'answer': answer,
                'questions_to_display': survey.question_ids,
                'scoring_display_correction': False,
                'format_datetime': lambda dt: format_datetime(self.env, dt, dt_format=False),
                'format_date': lambda date: format_date(self.env, date),
            })
        return data
