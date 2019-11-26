# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from math import ceil

from odoo import _, http
from odoo.http import request
from odoo.tools import ustr


class BaseSurveyController(http.Controller):

    # ------------------------------------------------------------
    # ACCESS
    # ------------------------------------------------------------

    def _fetch_from_access_token(self, survey_token, answer_token):
        """ Check that given token matches an answer from the given survey_id.
        Returns a sudo-ed browse record of survey in order to avoid access rights
        issues now that access is granted through token. """
        survey_sudo = request.env['survey.survey'].with_context(active_test=False).sudo().search([('access_token', '=', survey_token)])
        if not answer_token:
            answer_sudo = request.env['survey.user_input'].sudo()
        else:
            answer_sudo = request.env['survey.user_input'].sudo().search([
                ('survey_id', '=', survey_sudo.id),
                ('token', '=', answer_token)
            ], limit=1)
        return survey_sudo, answer_sudo

    # ------------------------------------------------------------
    # COMPLETED SURVEY UTILITY METHODS
    # ------------------------------------------------------------

    def _prepare_result_dict(self, survey, current_filters=None):
        """Returns dictionary having values for rendering template"""
        current_filters = current_filters if current_filters else []
        result = {'page_ids': []}

        # First append questions without page
        questions_without_page = [self._prepare_question_values(question, current_filters) for question in survey.question_ids if not question.page_id]
        if questions_without_page:
            result['page_ids'].append({'page': request.env['survey.question'], 'question_ids': questions_without_page})

        # Then, questions in sections
        for page in survey.page_ids:
            page_dict = {'page': page, 'question_ids': [self._prepare_question_values(question, current_filters) for question in page.question_ids]}
            result['page_ids'].append(page_dict)

        if survey.scoring_type in ['scoring_with_answers', 'scoring_without_answers']:
            scoring_data = self._get_scoring_data(survey)
            result['success_rate'] = scoring_data['success_rate']
            result['scoring_graph_data'] = json.dumps(scoring_data['graph_data'])

        return result

    def _prepare_question_values(self, question, current_filters):
        Survey = request.env['survey.survey']
        return {
            'question': question,
            'input_summary': Survey.get_input_summary(question, current_filters),
            'prepare_result': Survey.prepare_result(question, current_filters),
            'graph_data': self._get_graph_data(question, current_filters),
        }

    def _get_filter_data(self, post):
        """Returns data used for filtering the result"""
        filters = []
        filters_data = post.get('filters')
        if filters_data:
            for data in filters_data.split('|'):
                try:
                    row_id, answer_id = data.split(',')
                    filters.append({'row_id': int(row_id), 'answer_id': int(answer_id)})
                except:
                    return filters
        return filters

    def _get_graph_data(self, question, current_filters=None):
        '''Returns formatted data required by graph library on basis of filter'''
        # TODO refactor this terrible method and merge it with _prepare_result_dict
        current_filters = current_filters if current_filters else []
        Survey = request.env['survey.survey']
        result = []
        if question.question_type == 'multiple_choice':
            result.append({'key': ustr(question.title),
                           'values': Survey.prepare_result(question, current_filters)['answers']
                           })
        if question.question_type == 'simple_choice':
            result = Survey.prepare_result(question, current_filters)['answers']
        if question.question_type == 'matrix':
            data = Survey.prepare_result(question, current_filters)
            for answer in data['answers']:
                values = []
                for row in data['rows']:
                    values.append({'text': data['rows'].get(row), 'count': data['result'].get((row, answer))})
                result.append({'key': data['answers'].get(answer), 'values': values})
        return json.dumps(result)

    def _get_scoring_data(self, survey):
        """Performs a read_group to fetch the count of failed/passed tests in a single query."""

        count_data = request.env['survey.user_input'].read_group(
            [('survey_id', '=', survey.id), ('state', '=', 'done'), ('test_entry', '=', False)],
            ['quizz_passed', 'id:count_distinct'],
            ['quizz_passed']
        )

        quizz_passed_count = 0
        quizz_failed_count = 0
        for count_data_item in count_data:
            if count_data_item['quizz_passed']:
                quizz_passed_count = count_data_item['quizz_passed_count']
            else:
                quizz_failed_count = count_data_item['quizz_passed_count']

        graph_data = [{
            'text': _('Passed'),
            'count': quizz_passed_count,
            'color': '#2E7D32'
        }, {
            'text': _('Missed'),
            'count': quizz_failed_count,
            'color': '#C62828'
        }]

        total_quizz_passed = quizz_passed_count + quizz_failed_count
        return {
            'success_rate': round((quizz_passed_count / total_quizz_passed) * 100, 1) if total_quizz_passed > 0 else 0,
            'graph_data': graph_data
        }

    def page_range(self, total_record, limit):
        '''Returns number of pages required for pagination'''
        total = ceil(total_record / float(limit))
        return range(1, int(total + 1))
