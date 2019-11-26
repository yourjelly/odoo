# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import werkzeug

from odoo import http
from odoo.addons.survey.controllers.main import BaseSurveyController
from odoo.http import request


class UserInputSession(BaseSurveyController):
    @http.route('/survey/session_open/<string:survey_token>', type='http', auth='user', website=True)
    def survey_session_open(self, survey_token, **kwargs):
        """ Route called when opening a new survey session.
        It will allow the host to showcase the different options of the session and to actually start it. """
        survey_sudo, dummy = self._fetch_from_access_token(survey_token, False)
        current_session = survey_sudo.user_input_current_session

        if not current_session:
            # no open session
            return werkzeug.utils.redirect('/')

        return request.render('survey.user_input_session_open', {
            'session': current_session,
            'survey': survey_sudo
        })

    @http.route('/survey/session_start/<string:survey_token>', type='http', auth='user', website=True)
    def survey_session_start(self, survey_token, **kwargs):
        """ Route called when starting the session for all participants.
        It will move the current_question 'cursor' to the first question and redirect to the 'manage' route. """
        survey_sudo, dummy = self._fetch_from_access_token(survey_token, False)
        current_session = survey_sudo.user_input_current_session

        if not current_session:
            # no open session
            return werkzeug.utils.redirect('/')

        current_session.write({
            'state': 'in_progress'
        })
        current_session.next_question()

        return request.redirect('/survey/session_manage/%s' % survey_sudo.access_token)

    @http.route('/survey/session_manage/<string:survey_token>', type='http', auth='user', website=True)
    def survey_session_manage(self, survey_token, show_results=False, show_ranking=False, **kwargs):
        """ Main route to 'manage' the session.
        It will allow the host to show the question results, show the participants results or go to
        the next question of the session. """
        survey_sudo, dummy = self._fetch_from_access_token(survey_token, False)
        current_session = survey_sudo.user_input_current_session

        if not current_session:
            # no open session
            return werkzeug.utils.redirect('/')

        question_ids = list(enumerate(survey_sudo.question_ids))
        current_question_index = question_ids.index(
            next(question for question in question_ids if question[1] == current_session.current_question_id)
        )

        template_values = {
            'session': current_session,
            'survey': survey_sudo,
            'show_results': show_results,
            'show_ranking': show_ranking,
            'is_last_question': current_question_index == (len(survey_sudo.question_ids) - 1),
        }

        if show_results:
            template_values['prepared_question'] = self._prepare_question_values(
                current_session.current_question_id,
                False,
                current_session
            )

        if show_ranking:
            template_values['ranking'] = self._prepare_ranking_values(current_session)

        return request.render('survey.user_input_session_manage', template_values)
