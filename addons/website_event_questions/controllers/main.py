# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.http import request

from odoo.addons.website_event.controllers.main import WebsiteEventController


class WebsiteEvent(WebsiteEventController):

    def _process_attendees_form(self, event, form_details):
        """ Process data posted from the attendee details form.
        Extracts question answers:
        - For both questions asked 'once_per_order' and questions asked to every attendee
        - For questions of type 'simple_choice', extracting the suggested answer id
        - For questions of type 'text_box', extracting the text answer of the attendee. """
        registrations = super(WebsiteEvent, self)._process_attendees_form(event, form_details)

        for registration in registrations:
            registration['user_input_line_ids'] = []

        general_answer_ids = []
        for key, value in form_details.items():
            if 'question_answer' in key and value:
                dummy, registration_index, question_id = key.split('-')
                question = request.env['event.question'].browse(int(question_id))
                input_line_values = None
                if question.question_type == 'simple_choice':
                    input_line_values = {
                        'question_id': int(question_id),
                        'suggested_answer_id': int(value)
                    }
                elif question.question_type == 'text_box':
                    input_line_values = {
                        'question_id': int(question_id),
                        'value_text_box': value
                    }

                if input_line_values and not int(registration_index):
                    general_answer_ids.append((0, 0, input_line_values))
                elif input_line_values:
                    registrations[int(registration_index) - 1]['user_input_line_ids'].append((0, 0, input_line_values))

        for registration in registrations:
            registration['user_input_line_ids'].extend(general_answer_ids)

        return registrations
