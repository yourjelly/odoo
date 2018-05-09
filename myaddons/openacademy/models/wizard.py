# -*- coding: utf-8 -*-

from odoo import models, fields, api

class Wizard(models.TransientModel):
    # Private attribute
    # ------------------
    _name = 'openacademy.wizard'

    # Default Methods
    # ------------------
    def _default_session(self):
        return self.env['openacademy.session'].browse(self._context.get('active_id')) # get the active one
    
    # Fields Declaration
    # ------------------
    session_ids = fields.Many2many('openacademy.session', string="Session", required=True, default=_default_session) # Register students for many sessions
    # session_id = fields.Many2one('openacademy.session', string="Session", required=True, default=_default_session) # Register students for only one session
    student_ids = fields.Many2many('res.partner', string="Students")

    # Action methods
    # ------------------
    @api.multi
    def action_subscribe(self):
        for session in self.session_ids: # Register students for many sessions
            session.student_ids |= self.student_ids
            set_session_state = getattr(session, "set_state")
            set_session_state()
        # self.session_id.attendee_ids |= self.attendee_ids # Register students for only one session
        return {}