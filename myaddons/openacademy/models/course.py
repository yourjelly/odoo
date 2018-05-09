# -*- coding: utf-8 -*-
from datetime import timedelta
from odoo import models, api, fields
from odoo.exceptions import UserError

class Course(models.Model):
    # Private attribute
    # ------------------
    # Le champs id est automatiquement généré lors de l'install du model dans ODOO.
    # id = fields.Int(required=True)
    # Paramètre réservé. Référence de la class pour son accès par les autres class - Ou Référence de l'identifiant de l'objet
    _name = 'openacademy.course'

    # Fields Declaration
    # ------------------   
    # _rec_name = 'name' # --> this parameters allows to modify the default mandatory name of the 'name' field.
    name = fields.Char(string="Course Name", name="Title", required=True) # name = 'Title' ???
    description = fields.Text(string="Detail") # Description = texte libre, non obligatoire
    level = fields.Selection([('easy', 'Easy'), ('medium', 'Medium'), ('hard', 'Hard')], string="Level") # Level = Choix parmis une série définie de valeur.
    session_ids = fields.One2many('openacademy.session', 'course_id', string="Sessions") # Session Ids = Un cours peut être donné plusieurs fois, lors de différentes sessions -> One2Many. On y liste des Sessions (openacademy.session).. 
    responsible_id = fields.Many2one('res.partner', string="Responsible", domain=[('isTeacher', '=', True)]) # Un cours est géré par 1 seul prof mais un prof peut gérer plusieur cours. -> Many2one.
    students_count = fields.Integer(compute="_compute_student_count")

    # compute and search fields, (ordred by fields declaration)
    # ------------------
    @api.depends('session_ids.student_ids')
    def _compute_student_count(self):
        for course in self:
            course.students_count = len(course.mapped('session_ids.student_ids'))
            # the following method is wrong : because if a student is in two sessions, it will be counted twice.
            # course.students_count = 0
            # for session in course.session_ids:
            #    course.students_count += len(session.student_ids)

    # Action methods
    # ------------------         
    @api.multi
    def action_show_all_particitants(self):
        """ Open people view to see all participant of the course
            :return dict: dictionary value   """
        self.ensure_one()
        student_ids = self.session_ids.mapped('student_ids')
        action = {
            'name': 'Students of %s' % (self.name) + ' course',
            'type': 'ir.actions.act_window',
            'res_model': 'res.partner',
            'view_mode': 'tree,form',
            'view_type': 'form',
            'domain': [('id', 'in', student_ids.ids)],
        }
        return action


class Attendee(models.Model):
    _name = 'openacademy.attendee'

    # Ex02 solutions
    _rec_name = 'comment' # Need a char or text as rec_name
    _inherit = ['mail.thread']

    # EX02 solution : need a name
    comment = fields.Char("Comment", help="Subject of the mail send")

    partner_id = fields.Many2one('res.partner', 'Attendee Name', domain=[('is_company', '=', False)])
    session_id = fields.Many2one('openacademy.session', 'Session')
    course_id = fields.Many2one('openacademy.course', string="Course")

    state = fields.Selection([
        ('draft', "Draft"),
        ('confirmed', "Confirmed"),
        ('done', "Attended"),
        ('cancel', "Not Attended"),
        ], default='draft')

    _sql_constraints = [
       ('subscribe_once_per_session', 'UNIQUE(partner_id, session_id)',
        "You can only subscribe a partner once to the same session."),
    ]

    @api.one
    def action_draft(self):
        self.state = 'draft'

    # Solution EX03
    @api.one
    def action_confirm(self):
        if not self.session_id or self.session_id.remaining_seat <= 0:
            raise UserError("You cannot confirm a attendee that is not linked to a session or linked to a session with no remaining seat")
        self.state = 'confirmed'
        self._send_confirmation_email()

    @api.one
    def action_done(self):
        self.state = 'done'

    @api.one
    def action_cancel(self):
        self.state = 'cancel'

    # Solution EX03
    def _send_reception_email(self):
        template = self.env.ref('ex01.email_template_reception')
        self.message_post_with_template(template.id)

    # Solution EX03
    def _send_confirmation_email(self):
        template = self.env.ref('ex01.email_template_confirmation')
        self.message_post_with_template(template.id)

    # Solution EX03
    @api.model
    def create(self, vals):
        res = super(Attendee, self).create(vals)
        if res.state == 'confirmed':
            res._send_confirmation_email()
        else:
            res._send_reception_email()
        return res

    # ex02 Solutions
    @api.model
    def message_new(self, msg, custom_values=None):
        """ Override to updates the document according to the email. """
        custom_values = dict(custom_values) or {}
        custom_values['partner_id'] = msg.get('author_id')
        if 'session_id' not in custom_values and custom_values.get('course_id'):
            session_ids = self.env['openacademy.session'].search([('state', '=', 'confirmed'),
                                                                  ('start_date', '>', fields.Date.today()),
                                                                  ('remaining_seat', '>', 0)], order="start_date asc")
            if session_ids:
                custom_values['session_id'] = session_ids[0].id
        return super(Attendee, self).message_new(msg, custom_values=custom_values)
