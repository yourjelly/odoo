# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class HrEmployeeBase(models.AbstractModel):
    _inherit = "hr.employee.base"

    subordinate_ids = fields.Many2many(
        'hr.employee.base', string='Subordinates',
        compute='_compute_subordinates', compute_sudo=True, recursive=True,
        help="Direct and indirect subordinates")
    child_all_count = fields.Integer(
        'Indirect Subordinates Count',
        compute='_compute_subordinates', compute_sudo=True, recursive=True)
    is_subordinate = fields.Boolean(
        compute="_compute_is_subordinate", recursive=True,
        search="_search_is_subordinate")

    @api.depends('child_ids.subordinate_ids', 'child_ids.child_all_count')
    def _compute_subordinates(self):
        for employee in self:
            employee.subordinate_ids = employee.child_ids | employee.child_ids.subordinate_ids
            employee.child_all_count = len(employee.subordinate_ids)

    @api.depends_context('uid', 'company')
    @api.depends('parent_id.is_subordinate')
    def _compute_is_subordinate(self):
        subordinates = set(self.env.user.employee_id.subordinate_ids)
        for employee in self:
            employee.is_subordinate = employee in subordinates

    def _search_is_subordinate(self, operator, value):
        if operator not in ('=', '!=') or not isinstance(value, bool):
            raise UserError(_('Operation not supported'))
        # determine whether we search for being subordinate or not
        test_is_subordinate = value if operator == '=' else not value
        if test_is_subordinate:
            return [('id', 'in', self.env.user.employee_id.subordinate_ids.ids)]
        else:
            return [('id', 'not in', self.env.user.employee_id.subordinate_ids.ids)]
