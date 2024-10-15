# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models
from odoo.addons import hr


class HrDepartment(hr.HrDepartment):

    def _compute_expense_sheets_to_approve(self):
        expense_sheet_data = self.env['hr.expense.sheet']._read_group([('department_id', 'in', self.ids), ('state', '=', 'submit')], ['department_id'], ['__count'])
        result = {department.id: count for department, count in expense_sheet_data}
        for department in self:
            department.expense_sheets_to_approve_count = result.get(department.id, 0)

    expense_sheets_to_approve_count = fields.Integer(compute='_compute_expense_sheets_to_approve', string='Expenses Reports to Approve')
