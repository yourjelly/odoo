# -*- coding: utf-8 -*-
from datetime import datetime, timedelta
from odoo import models, api, fields, exceptions


class Session(models.Model):
    # Private attribute
    # ------------------
    _name = 'openacademy.session'
    _inherit = ['mail.thread'] # Module Discuss (Mail) must be installed
    _order = 'name'

    # Default methods
    # ------------------


    # Fields Declaration
    # ------------------
    name = fields.Char(required=True)
    description = fields.Text()
    course_id = fields.Many2one(
        'openacademy.course', ondelete="cascade", string="Course", required=True) # Course_ID -> Plusieurs session peuvent être donnée sur le même cours. Mais une session ne peut etre données sur plusieurs cours. -> Many2one
    teacher_id = fields.Many2one(
        'res.partner', string="Teacher", domain=[('isTeacher','=',True)]) # Teacher_id -> 1 session est donnée par 1 prof mais 1 prof peut donner plusieurs sessions du même cours -> Many2one
    
    state = fields.Selection(
        [('draft', 'In Preparation'),('waiting', 'Waiting Inscription'),('confirmed', 'Ready to be given'),('canceled', 'Canceled')], string="State")
    isReady = fields.Boolean(default=False, string="IsReady") # isReady -> true or false : true = can be given, false = in preparation
    isArchived = fields.Boolean(default=False, string="isArchived")

    student_ids = fields.Many2many(
        'res.partner', string="Student") # Student_Ids -> 1 session peut avoir plusieurs étudiants et 1 étudiant peut suivre plusieurs cours -> Many2many
    attendees_count = fields.Integer(
        string="Attendees count", compute='_get_attendees_count', store=True) #store = true because used for graph view and graph view does not work with non-stored values
    capacity = fields.Integer()
    capacity_index = fields.Integer(compute="_compute_capacity_index")
    isFull = fields.Boolean(compute="_compute_capacity_index", default=False, store=True, readonly=True)
    
    startDate = fields.Date(default=fields.Date.today())
    duration = fields.Integer(help="Duration in days", default=1) # Duration : number of days the session takes, with duration instead of endDate, it's easier to know directly the duration and endDate can be computed if needed
    endDate = fields.Date(compute="_get_endDate", inverse="_set_endDate", store=True)
    hours = fields.Float(string="Duration in hours",
                        compute='_get_hours', inverse='_set_hours')
    
    color = fields.Integer() # For Kanban

    #   Play with ORM Module
    invoice_line_ids = fields.One2many('openacademy.invoice.line', 'session_id', string='Invoices')
    cost = fields.Float(default=50.0)
    is_paid = fields.Boolean()

    # compute and search fields, (ordred by fields declaration)
    # ------------------
    @api.depends('student_ids')
    def _get_attendees_count(self):
        for r in self:
            r.attendees_count = len(r.student_ids)

    @api.depends('student_ids','capacity')
    def _compute_capacity_index(self):
        for session in self:
            # if capcity is not filled.
            if(not session.capacity):
                session.capacity_index = 0.0
            else:
                session.capacity_index = 100 * len(session.student_ids) / session.capacity
                self.set_state()
                if(session.capacity_index >= 100):
                    session.isFull = True
                    if(session.capacity_index > 100):
                        return {'warning': {
                            'title': 'Session fully booked',
                            'message': 'The room has only %s available seats' % (session.capacity)
                        }}
                else:
                    session.isFull = False
    
    @api.depends('startDate','duration')
    def _get_endDate(self):
        for session in self:
            if session.duration != 0:
                session.endDate = datetime.strptime(session.startDate, "%Y-%m-%d") + timedelta(days=(session.duration-1))

    def _set_endDate(self):
        for session in self:
            session.duration = (datetime.strptime(session.endDate, "%Y-%m-%d") - datetime.strptime(session.startDate, "%Y-%m-%d")).days + 1

    @api.depends('duration')
    def _get_hours(self):
        for r in self:
            r.hours = r.duration * 24

    def _set_hours(self):
        for r in self:
            r.duration = r.hours / 24

    # Constraints and onchanges
    # ------------------
    @api.constrains('teacher_id', 'student_ids')
    def _check_instructor_not_in_attendees(self):
        for r in self:
            if r.teacher_id and r.teacher_id in r.student_ids:
                raise exceptions.ValidationError("A session's teacher can't be a student")

    @api.constrains('isFull')
    def _check_new_booking(self):
        for session in self:
            if (session.isFull and session.capacity_index > 100):
                raise exceptions.ValidationError("This course is fully booked.")

    @api.onchange('course_id')
    def _onchange_course_id(self):
        self.teacher_id = self.course_id.responsible_id

    # CRUD methods overrides
    # ------------------

    # Action Methods (Buttons, etc..)
    # ------------------
    @api.one
    def action_cancel_session(self):
        for session in self:
            session.state = 'canceled'
            session.message_post(body="Session %s of the course %s canceled" % (session.name, session.course_id.name))

    @api.one
    def action_waiting_session(self):
        for session in self:
            session.state = 'waiting'
            session.message_post(body="Session %s of the course %s is still waiting for more attendees" % (session.name, session.course_id.name))

    @api.one
    def action_confirm_session(self):
        for session in self:
            session.state = 'confirmed'
            session.message_post(body="Session %s of the course %s confirmed" % (session.name, session.course_id.name))

    @api.one
    def action_create_invoice(self):
        for session in self:
            invoice = self.env['openacademy.invoice'].search([('teacher_id','=',session.teacher_id.id)])
            if (not invoice):
                invoice = self.env['openacademy.invoice'].create({
                    'teacher_id': session.teacher_id.id,
                })
            invoice_line = self.env['openacademy.invoice.line'].search([('session_id','=',session.id)])
            if (not invoice_line):
                invoice_line = self.env['openacademy.invoice.line'].create({
                    'invoice_id': invoice.id,
                    'session_id': session.id,
                    'amount': session.cost * len(session.student_ids),
                })
            else:
                print('update invoice')
                invoice_line.write({
                    'amount': session.cost * len(session.student_ids),
                })
            session.is_paid = True

    @api.one
    def action_recall_invoice(self):
        for session in self:
            self.env['openacademy.invoice.line'].search([('session_id','=',session.id)]).unlink()
            session.is_paid = False

    # Business methods
    # ----------------
    def set_state(self):
        for session in self:
            if (session.state == 'waiting' or session.state == 'confirmed'):
                if(session.capacity_index >= 50):
                    session.state = 'confirmed'
                else:
                    session.state = 'waiting'