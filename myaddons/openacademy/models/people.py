# -*- coding: utf-8 -*- 
from odoo import models, api, fields, http

# extend the existing model res.partner
class Partner(models.Model):
    # Private attribute
    # ------------------
    _inherit = 'res.partner'

    # Fields Declaration
    # ------------------
    # Add new fields to the res.partner model
    isTeacher = fields.Boolean("Instructor", default=False)
    session_ids = fields.Many2many('openacademy.session', string="Sessions", readonly=True) 
    invoice_id = fields.Many2one('openacademy.invoice', string='Invoice', compute="_compute_invoice_id")
    biography = fields.Html()

    # Compute Fields
    # ------------------
    def _compute_invoice_id(self):
        for partner in self:
            partner.invoice_id = self.env['openacademy.invoice'].search([('teacher_id', '=', partner.id)]).id
            

# create new class that inherit structure from res.partner.
class People(models.Model):
    # Private attribute
    # ------------------
    _name = 'openacademy.people'
    _inherits = {'res.partner': 'partner_id'}

    # Fields Declaration
    # ------------------
    #name = fields.Char(name="Name", required=True) --> with delegation inheritance, not required -> name comes from the parent class
    partner_id = fields.Many2one('res.partner', required=True, ondelete='cascade')
    age = fields.Integer()

