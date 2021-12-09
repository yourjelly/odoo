# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models
from odoo.tools import format_datetime, format_date, is_html_empty


class IrActionsReport(models.Model):
    _inherit = 'ir.actions.report'

    def _get_rendering_context(self, docids, data):
        data = super()._get_rendering_context(docids, data)

        if self.report_name in ['survey.survey_page_print_report', 'survey.survey_answer_print_report']:
            docs = data.get('docs')
            if self.report_name == 'survey.survey_page_print_report':
                survey = docs
                answer = self.env['survey.user_input']  # template expects the empty user input in case of print survey report
            else:
                survey = docs.survey_id
                answer = docs
            data.update({
                'is_html_empty': is_html_empty,
                'review': False,
                'survey': survey,
                'answer': answer if survey.scoring_type != 'scoring_without_answers' else answer.browse(),
                'questions_to_display': answer._get_print_questions(),
                'scoring_display_correction': survey.scoring_type == 'scoring_with_answers' and answer,
                'format_datetime': lambda dt: format_datetime(self.env, dt, dt_format=False),
                'format_date': lambda date: format_date(self.env, date),
            })
        return data
