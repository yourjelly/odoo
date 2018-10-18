
# -*- coding: utf-8 -*-

from functools import partial

from odoo import models, fields


class PosSession(models.Model):
    _inherit = 'pos.session'
    employee_id = fields.Many2one('hr.employee', string='Sales Person',
        required=False, index=True, readonly=True)
