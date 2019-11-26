# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
import logging
import werkzeug

from datetime import datetime
from dateutil.relativedelta import relativedelta

from odoo import fields, http, _
from odoo.addons.base.models.ir_ui_view import keep_query
from odoo.addons.survey.controllers.main import BaseSurveyController
from odoo.exceptions import UserError
from odoo.http import request, content_disposition
from odoo.tools import format_datetime, format_date

_logger = logging.getLogger(__name__)


class Survey(BaseSurveyController):

    # ------------------------------------------------------------
    # ACCESS
    # ------------------------------------------------------------

    def _check_validity(self, survey_token, answer_token, ensure_token=True):
        """ Check survey is open and can be taken. This does not checks for
        security rules, only functional / business rules. It returns a string key
        allowing further manipulation of validity issues

         * survey_wrong: survey does not exist;
         * survey_auth: authentication is required;
         * survey_closed: survey is closed and does not accept input anymore;
         * survey_void: survey is void and should not be taken;
         * token_wrong: given token not recognized;
         * token_required: no token given although it is necessary to access the
           survey;
         * answer_done: token linked to a finished answer;
         * answer_deadline: token linked to an expired answer;

        :param ensure_token: whether user input existence based on given access token
          should be enforced or not, depending on the route requesting a token or
          allowing external world calls;
        """
        survey_sudo, answer_sudo = self._fetch_from_access_token(survey_token, answer_token)

        if not survey_sudo.exists():
            return 'survey_wrong'

        if answer_token and not answer_sudo:
            return 'token_wrong'

        if not answer_sudo and ensure_token:
            return 'token_required'
        if not answer_sudo and survey_sudo.access_mode == 'token':
            return 'token_required'

        if survey_sudo.users_login_required and request.env.user._is_public():
            return 'survey_auth'

        if (survey_sudo.state == 'closed' or survey_sudo.state == 'draft' or not survey_sudo.active) and (not answer_sudo or not answer_sudo.test_entry):
            return 'survey_closed'

        if (not survey_sudo.page_ids and survey_sudo.questions_layout == 'page_per_section') or not survey_sudo.question_ids:
            return 'survey_void'

        if answer_sudo and answer_sudo.state == 'done':
            return 'answer_done'

        if answer_sudo and answer_sudo.deadline and answer_sudo.deadline < datetime.now():
            return 'answer_deadline'

        return True

    def _get_access_data(self, survey_token, answer_token, ensure_token=True):
        """ Get back data related to survey and user input, given the ID and access
        token provided by the route.

         : param ensure_token: whether user input existence should be enforced or not(see ``_check_validity``)
        """
        survey_sudo, answer_sudo = request.env['survey.survey'].sudo(), request.env['survey.user_input'].sudo()
        has_survey_access, can_answer = False, False

        validity_code = self._check_validity(survey_token, answer_token, ensure_token=ensure_token)
        if validity_code != 'survey_wrong':
            survey_sudo, answer_sudo = self._fetch_from_access_token(survey_token, answer_token)
            try:
                survey_user = survey_sudo.with_user(request.env.user)
                survey_user.check_access_rights(self, 'read', raise_exception=True)
                survey_user.check_access_rule(self, 'read')
            except:
                pass
            else:
                has_survey_access = True
            can_answer = bool(answer_sudo)
            if not can_answer:
                can_answer = survey_sudo.access_mode == 'public'

        return {
            'survey_sudo': survey_sudo,
            'answer_sudo': answer_sudo,
            'has_survey_access': has_survey_access,
            'can_answer': can_answer,
            'validity_code': validity_code,
        }

    def _redirect_with_error(self, access_data, error_key):
        survey_sudo = access_data['survey_sudo']
        answer_sudo = access_data['answer_sudo']

        if error_key == 'survey_void' and access_data['can_answer']:
            return request.render("survey.survey_void_content", {'survey': survey_sudo, 'answer': answer_sudo})
        elif error_key == 'survey_closed' and access_data['can_answer']:
            return request.render("survey.survey_closed_expired", {'survey': survey_sudo})
        elif error_key == 'survey_auth' and answer_sudo.token:
            if answer_sudo.partner_id and (answer_sudo.partner_id.user_ids or survey_sudo.users_can_signup):
                if answer_sudo.partner_id.user_ids:
                    answer_sudo.partner_id.signup_cancel()
                else:
                    answer_sudo.partner_id.signup_prepare(expiration=fields.Datetime.now() + relativedelta(days=1))
                redirect_url = answer_sudo.partner_id._get_signup_url_for_action(url='/survey/start/%s?answer_token=%s' % (survey_sudo.access_token, answer_sudo.token))[answer_sudo.partner_id.id]
            else:
                redirect_url = '/web/login?redirect=%s' % ('/survey/start/%s?answer_token=%s' % (survey_sudo.access_token, answer_sudo.token))
            return request.render("survey.survey_auth_required", {'survey': survey_sudo, 'redirect_url': redirect_url})
        elif error_key == 'answer_deadline' and answer_sudo.token:
            return request.render("survey.survey_closed_expired", {'survey': survey_sudo})
        elif error_key == 'answer_done' and answer_sudo.token:
            return request.render("survey.survey_closed_finished", self._prepare_survey_finished_values(survey_sudo, answer_sudo, token=answer_sudo.token))

        return werkzeug.utils.redirect("/")

    @http.route('/survey/test/<string:survey_token>', type='http', auth='user', website=True)
    def survey_test(self, survey_token, **kwargs):
        """ Test mode for surveys: create a test answer, only for managers or officers
        testing their surveys """
        survey_sudo, dummy = self._fetch_from_access_token(survey_token, False)
        try:
            answer_sudo = survey_sudo._create_answer(user=request.env.user, test_entry=True)
        except:
            return werkzeug.utils.redirect('/')
        return request.redirect('/survey/start/%s?%s' % (survey_sudo.access_token, keep_query('*', answer_token=answer_sudo.token)))

    @http.route('/survey/retry/<string:survey_token>/<string:answer_token>', type='http', auth='public', website=True)
    def survey_retry(self, survey_token, answer_token, **post):
        """ This route is called whenever the user has attempts left and hits the 'Retry' button
        after failing the survey."""
        access_data = self._get_access_data(survey_token, answer_token, ensure_token=True)
        if access_data['validity_code'] is not True and access_data['validity_code'] != 'answer_done':
            return self._redirect_with_error(access_data, access_data['validity_code'])

        survey_sudo, answer_sudo = access_data['survey_sudo'], access_data['answer_sudo']
        if not answer_sudo:
            # attempts to 'retry' without having tried first
            return werkzeug.utils.redirect("/")

        try:
            retry_answer_sudo = survey_sudo._create_answer(
                user=request.env.user,
                partner=answer_sudo.partner_id,
                email=answer_sudo.email,
                invite_token=answer_sudo.invite_token,
                **self._prepare_retry_additional_values(answer_sudo)
            )
        except:
            return werkzeug.utils.redirect("/")
        return request.redirect('/survey/start/%s?%s' % (survey_sudo.access_token, keep_query('*', answer_token=retry_answer_sudo.token)))

    def _prepare_retry_additional_values(self, answer):
        return {
            'deadline': answer.deadline,
        }

    # ------------------------------------------------------------
    # TAKING SURVEY ROUTES
    # ------------------------------------------------------------

    @http.route('/survey/start/<string:survey_token>', type='http', auth='public', website=True)
    def survey_start(self, survey_token, answer_token=None, email=False, **post):
        """ Start a survey by providing
         * a token linked to a survey;
         * a token linked to an answer or generate a new token if access is allowed;
        """
        access_data = self._get_access_data(survey_token, answer_token, ensure_token=False)
        if access_data['validity_code'] is not True:
            return self._redirect_with_error(access_data, access_data['validity_code'])

        survey_sudo, answer_sudo = access_data['survey_sudo'], access_data['answer_sudo']
        if not answer_sudo:
            try:
                answer_sudo = survey_sudo._create_answer(user=request.env.user, email=email)
            except UserError:
                answer_sudo = False

        if not answer_sudo:
            try:
                survey_sudo.with_user(request.env.user).check_access_rights('read')
                survey_sudo.with_user(request.env.user).check_access_rule('read')
            except:
                return werkzeug.utils.redirect("/")
            else:
                return request.render("survey.survey_403_page", {'survey': survey_sudo})

        current_session_state = answer_sudo.user_input_session_id and answer_sudo.user_input_session_id.state
        # Select the right page
        if answer_sudo.state == 'new' and current_session_state != 'in_progress':  # Intro page
            data = {'survey': survey_sudo, 'answer': answer_sudo, 'page': 0}
            if current_session_state == 'ready' and not answer_token:
                # force the answer_token to avoid re-creating answers on refresh
                return request.redirect('/survey/start/%s?answer_token=%s' % (survey_sudo.access_token, answer_sudo.token))
            else:
                return request.render('survey.survey_page_start', data)
        else:
            return request.redirect('/survey/fill/%s/%s' % (survey_sudo.access_token, answer_sudo.token))

    @http.route('/survey/fill/<string:survey_token>/<string:answer_token>', type='http', auth='public', website=True)
    def survey_display_page(self, survey_token, answer_token, **post):
        access_data = self._get_access_data(survey_token, answer_token, ensure_token=True)
        if access_data['validity_code'] is not True:
            return self._redirect_with_error(access_data, access_data['validity_code'])

        survey_sudo, answer_sudo = access_data['survey_sudo'], access_data['answer_sudo']

        data = {
            'format_datetime': lambda dt: format_datetime(request.env, dt, dt_format=False),
            'format_date': lambda date: format_date(request.env, date)
        }

        page_or_question_key = 'question' if survey_sudo.questions_layout == 'page_per_question' else 'page'

        # Bypass all if page_id is specified (comes from breadcrumb or previous button)
        if 'previous_page_id' in post:
            previous_page_or_question_id = int(post['previous_page_id'])
            new_previous_id = survey_sudo._previous_page_or_question_id(answer_sudo, previous_page_or_question_id)
            data.update({
                'survey': survey_sudo,
                page_or_question_key: request.env['survey.question'].sudo().browse(previous_page_or_question_id),
                'answer': answer_sudo,
                'previous_page_id': new_previous_id
            })
            return request.render('survey.survey_page_main', data)

        if survey_sudo.is_time_limited and not answer_sudo.start_datetime:
            # init start date when user starts filling in the survey
            answer_sudo.write({
                'start_datetime': fields.Datetime.now()
            })

        # Select the right page
        if answer_sudo.state == 'new':  # First page
            page_or_question_id, is_last = survey_sudo.next_page_or_question(answer_sudo, 0)
            data.update({
                'survey': survey_sudo,
                page_or_question_key: page_or_question_id,
                'answer': answer_sudo,
            })
            if is_last:
                data.update({'last': True})
            return request.render('survey.survey_page_main', data)
        elif answer_sudo.state == 'done':  # Display success message
            return request.render('survey.survey_closed_finished', self._prepare_survey_finished_values(survey_sudo, answer_sudo))
        elif answer_sudo.state == 'skip':
            page_or_question_id, is_last = survey_sudo.next_page_or_question(answer_sudo, answer_sudo.last_displayed_page_id.id)
            previous_id = survey_sudo._previous_page_or_question_id(answer_sudo, page_or_question_id.id)

            data.update({
                'survey': survey_sudo,
                page_or_question_key: page_or_question_id,
                'answer': answer_sudo,
                'previous_page_id': previous_id
            })
            if is_last:
                data.update({'last': True})

            return request.render('survey.survey_page_main', data)
        else:
            return request.render("survey.survey_403_page", {'survey': survey_sudo})

    @http.route('/survey/submit/<string:survey_token>/<string:answer_token>', type='json', auth='public', website=True)
    def survey_submit(self, survey_token, answer_token, **post):
        """ Submit a page from the survey.
        This will take into account the validation errors and store the answers to the questions.
        If the time limit is reached, errors will be skipped, answers will be ignored and
        survey state will be forced to 'done'"""
        # Survey Validation
        access_data = self._get_access_data(survey_token, answer_token, ensure_token=True)
        if access_data['validity_code'] is not True:
            return {
                'error': access_data['validity_code'],
            }
        survey_sudo, answer_sudo = access_data['survey_sudo'], access_data['answer_sudo']

        questions, page_or_question_id = survey_sudo._get_survey_questions(answer=answer_sudo,
                                                                           page_id=post.get('page_id'),
                                                                           question_id=post.get('question_id'))

        if not answer_sudo.test_entry and not survey_sudo._has_attempts_left(answer_sudo.partner_id, answer_sudo.email, answer_sudo.invite_token):
            # prevent cheating with users creating multiple 'user_input' before their last attempt
            return {}

        if not answer_sudo.is_time_limit_reached:
            # Prepare answers and comment by question
            prepared_questions = {}
            for question in questions:
                answer_full = post.get(str(question.id))
                answer_without_comment, comment = self._extract_comment_from_answers(question, answer_full)
                prepared_questions[question.id] = {'answer': answer_without_comment, 'comment': comment}

            # Questions Validation
            errors = {}
            for question in questions:
                answer = prepared_questions[question.id]['answer']
                comment = prepared_questions[question.id]['comment']
                errors.update(question.validate_question(answer, comment))
            if errors:
                return {'error': 'validation', 'fields': errors}

            # Submitting questions
            for question in questions:
                answer = prepared_questions[question.id]['answer']
                comment = prepared_questions[question.id]['comment']
                request.env['survey.user_input_line'].sudo().save_lines(answer_sudo, question, answer, comment)

        # if we're in a survey session, we don't mark the answer as "done", the host will do it when it ends the session
        if (answer_sudo.is_time_limit_reached or survey_sudo.questions_layout == 'one_page') and not answer_sudo.user_input_session_id:
            answer_sudo._mark_done()
        elif 'previous_page_id' in post:
            # Go back to specific page using the breadcrumb. Lines are saved and survey continues
            return '/survey/fill/%s/%s?previous_page_id=%s' % (survey_sudo.access_token, answer_token, post['previous_page_id'])
        else:
            next_page, unused = request.env['survey.survey'].next_page_or_question(answer_sudo, page_or_question_id)
            vals = {'last_displayed_page_id': page_or_question_id}

            if next_page is None:
                answer_sudo._mark_done()
            else:
                vals.update({'state': 'skip'})

            answer_sudo.write(vals)

        return '/survey/fill/%s/%s' % (survey_sudo.access_token, answer_token)

    # ------------------------------------------------------------
    # COMPLETED SURVEY ROUTES
    # ------------------------------------------------------------

    @http.route('/survey/print/<string:survey_token>', type='http', auth='public', website=True, sitemap=False)
    def survey_print(self, survey_token, review=False, answer_token=None, **post):
        '''Display an survey in printable view; if <answer_token> is set, it will
        grab the answers of the user_input_id that has <answer_token>.'''
        access_data = self._get_access_data(survey_token, answer_token, ensure_token=False)
        if access_data['validity_code'] is not True and (
                access_data['has_survey_access'] or
                access_data['validity_code'] not in ['token_required', 'survey_closed', 'survey_void', 'answer_done']):
            return self._redirect_with_error(access_data, access_data['validity_code'])

        survey_sudo, answer_sudo = access_data['survey_sudo'], access_data['answer_sudo']

        if survey_sudo.scoring_type == 'scoring_without_answers':
            return request.render("survey.survey_403_page", {'survey': survey_sudo})

        return request.render('survey.survey_page_print', {
            'review': review,
            'survey': survey_sudo,
            'answer': answer_sudo,
            'format_datetime': lambda dt: format_datetime(request.env, dt, dt_format=False),
            'format_date': lambda date: format_date(request.env, date)
        })

    @http.route([
        '/survey/results/<model("survey.survey"):survey>',
        '/survey/results/<model("survey.survey"):survey>/<model("survey.user_input_session"):session>'],
        type='http', auth='user', website=True)
    def survey_report(self, survey, session=None, answer_token=None, session_id=None, **post):
        '''Display survey Results & Statistics for given survey.'''
        template_values = self._prepare_survey_result(session.survey_id, session=session, question=False, **post)
        if session:
            template_values['ranking'] = self._prepare_ranking_values(session)

        return request.render('survey.survey_page_statistics', template_values)
        # Quick retroengineering of what is injected into the template for now:
        # (TODO: flatten and simplify this)
        #
        #     survey: a browse record of the survey
        #     survey_dict: very messy dict containing all the info to display answers
        #         {'page_ids': [
        #
        #             ...
        #
        #                 {'page': browse record of the page,
        #                  'question_ids': [
        #
        #                     ...
        #
        #                     {'graph_data': data to be displayed on the graph
        #                      'input_summary': number of answered, skipped...
        #                      'prepare_result': {
        #                                         answers displayed in the tables
        #                                         }
        #                      'question': browse record of the question_ids
        #                     }
        #
        #                     ...
        #
        #                     ]
        #                 }
        #
        #             ...
        #
        #             ]
        #         }
        #
        #     page_range: pager helper function
        #     current_filters: a list of ids
        #     filter_display_data: [{'labels': ['a', 'b'], question_text} ...  ]
        #     filter_finish: boolean => only finished surveys or not
        #

    @http.route(['/survey/<int:survey_id>/get_certification'], type='http', auth='user', methods=['GET'], website=True)
    def survey_get_certification(self, survey_id, **kwargs):
        """ The certification document can be downloaded as long as the user has succeeded the certification """
        survey = request.env['survey.survey'].sudo().search([
            ('id', '=', survey_id),
            ('certificate', '=', True)
        ])

        if not survey:
            # no certification found
            return werkzeug.utils.redirect("/")

        succeeded_attempt = request.env['survey.user_input'].sudo().search([
            ('partner_id', '=', request.env.user.partner_id.id),
            ('survey_id', '=', survey_id),
            ('quizz_passed', '=', True)
        ], limit=1)

        if not succeeded_attempt:
            raise UserError(_("The user has not succeeded the certification"))

        report_sudo = request.env.ref('survey.certification_report').sudo()

        report = report_sudo.render_qweb_pdf([succeeded_attempt.id], data={'report_type': 'pdf'})[0]
        reporthttpheaders = [
            ('Content-Type', 'application/pdf'),
            ('Content-Length', len(report)),
        ]
        reporthttpheaders.append(('Content-Disposition', content_disposition('Certification.pdf')))
        return request.make_response(report, headers=reporthttpheaders)

    def _prepare_survey_finished_values(self, survey, answer, token=False):
        values = {'survey': survey, 'answer': answer}
        if token:
            values['token'] = token
        if survey.scoring_type != 'no_scoring' and survey.certificate:
            answer_perf = survey._get_answers_correctness(answer)[answer]
            values['graph_data'] = json.dumps([
                {"text": "Correct", "count": answer_perf['correct']},
                {"text": "Partially", "count": answer_perf['partial']},
                {"text": "Incorrect", "count": answer_perf['incorrect']},
                {"text": "Unanswered", "count": answer_perf['skipped']}
            ])
        return values

    def _extract_comment_from_answers(self, question, answers):
        """
        As answer is a custom structure depending of the question type
        that can contain question answers but also comment that need to be extracted
        before validating and saving answers.
        If multiple answers, they are listed in an array, except for matrix where answers are structured differently.
        See input and output for more info on data structures.
        :param question: survey.question
        :param answers: {str} answer (for simple questions)
                    or {list} [answer_1,...,answer_n] (for questions with multiple answers)
                    or {list} [answer_1, {'comment': comment}] (for questions with simple answers and with comment)
                    or {list} [answer_1,...,answer_n, {'comment': comment}] (for questions with multiple answers with comment)
                    or {list} [{sub_question_1: [answer_1,...,answer_n]}, {sub_question_2: [...]}] (for matrix without comment)
                    or {list} [{sub_question_1: [answer_1,...,answer_n]}, {sub_question_2: [...]}, {'comment': comment}] (for matrix with comment)
        :return: answers_no_comment : {str} answer for simple choice (or text and number) question types
                                  or {list} [answer_1,...,answer_n] for multiple choices question types except matrix
                                  or {list} [{sub_question_1: [answer_1,...,answer_n]}, {sub_question_2: [...]}] for matrix
                 comment : {str} extracted comment for the given question
        """
        comment = None
        answers_no_comment = []
        if answers:
            if question.question_type == 'matrix':
                if 'comment' in answers:
                    comment = answers['comment'].strip()
                    answers.pop('comment')
                answers_no_comment = answers
            else:
                if not isinstance(answers, list):
                    answers = [answers]
                for answer in answers:
                    if 'comment' in answer:
                        comment = answer['comment'].strip()
                    else:
                        answers_no_comment.append(answer)
                if len(answers_no_comment) == 1:
                    answers_no_comment = answers_no_comment[0]
        return answers_no_comment, comment
