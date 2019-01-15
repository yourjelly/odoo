# -*- coding: utf-8 -*-

from functools import partial

from odoo import models, fields, _


class PosConfig(models.Model):
    _inherit = 'pos.config'

    def _get_fields_to_check(self):
        res = super(PosConfig, self)._get_fields_to_check()
        res.update({
                'employee_ids': _('Employee ids')
                })
        return res

    employee_ids = fields.Many2many(
        'hr.employee', string="Employees with access",
        help='If left empty, all employees can log in to the PoS session')
