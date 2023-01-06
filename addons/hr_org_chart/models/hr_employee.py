# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class Employee(models.Model):
    _inherit = ["hr.employee"]

    # override of hr.employee.base field to get the right comodel
    subordinate_ids = fields.Many2many('hr.employee')


class HrEmployeePublic(models.Model):
    _inherit = ["hr.employee.public"]

    # override of hr.employee.base field to get the right comodel
    subordinate_ids = fields.Many2many('hr.employee.public')
