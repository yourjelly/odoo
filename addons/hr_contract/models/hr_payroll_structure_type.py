# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class HrPayrollStructureType(models.Model):
    _name = 'hr.payroll.structure.type'
    _description = 'Salary Structure Type'

    name = fields.Char('Salary Structure Type')
    # sgv todo, probably remove default value here and maybe add onchange method
    # that depends on country_id in hr_payroll/models/hr_payroll_structure_type.py
    default_resource_calendar_id = fields.Many2one(
        'resource.calendar', 'Default Working Hours',
        default=lambda self: self.env.company.resource_calendar_id)
    country_id = fields.Many2one('res.country', string='Country', default=lambda self: self.env.company.country_id)
