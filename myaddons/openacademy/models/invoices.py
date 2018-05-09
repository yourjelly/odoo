# -*- coding: utf-8 -*-
from datetime import datetime, timedelta
from odoo import models, api, fields, exceptions

class Invoice(models.Model):
    # Private attribute
    # ------------------
    _name = 'openacademy.invoice'

    # Fields Declaration
    # ------------------
    name = fields.Char(readonly=True, compute="_compute_default_name", store=True)
    teacher_id = fields.Many2one('res.partner', string='Teacher', required=True, domain=[('isTeacher', '=', True)])
    invoice_line_ids = fields.One2many('openacademy.invoice.line', 'invoice_id', string='Entry')
    total_amount = fields.Float(compute="_compute_total_amount")

    # compute and search fields, (ordred by fields declaration)
    # ------------------
    @api.depends('teacher_id')
    def _compute_default_name(self):
        for invoice in self:
            if (invoice.teacher_id.name != False):
                invoice.name = invoice.teacher_id.name + '_' + 'invoice'
            else:
                invoice.name = 'teacher_' + 'invoice'

    @api.depends('invoice_line_ids')
    def _compute_total_amount(self):
        for invoice in self:
            invoice.total_amount = 0.0
            for line in invoice.invoice_line_ids:
                invoice.total_amount += line.amount

class Invoice_line(models.Model):
    # Private attribute
    # ------------------
    _name = 'openacademy.invoice.line'

    # Fields Declaration
    # ------------------
    name = fields.Char(readonly=True, compute="_compute_default_name", store=True)
    invoice_id = fields.Many2one('openacademy.invoice', string='Invoice')
    session_id = fields.Many2one('openacademy.session', string='Session')
    session_cost = fields.Float(related='session_id.cost', string='Session Cost')
    session_attendees_count = fields.Integer(related='session_id.attendees_count', string='Nbr of Session Attendees')
    amount = fields.Float()

    # compute and search fields, (ordred by fields declaration)
    # ------------------
    @api.depends('invoice_id')
    def _compute_default_name(self):
        for line in self:
            if (line.invoice_id.name != False):
                line.name = line.invoice_id.name + '_' + str(line.id)
            else:
                line.name = 'invoice_' + str(line.id)

