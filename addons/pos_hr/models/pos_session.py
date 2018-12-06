
# -*- coding: utf-8 -*-

from odoo import models, fields


class PosSession(models.Model):
    _inherit = 'pos.session'
    employee_id = fields.Many2one('hr.employee', string='Sales Person', index=True, readonly=True)
