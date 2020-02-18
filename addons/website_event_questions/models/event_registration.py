# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class EventRegistration(models.Model):
    """ Store answers on attendees. """
    _inherit = 'event.registration'

    user_input_line_ids = fields.One2many('event.user_input.line', 'registration_id', string='Attendee Answers')
