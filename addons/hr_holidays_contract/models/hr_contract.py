# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime

from datetime import date, datetime
from odoo import api, models


class HrContract(models.Model):
    _inherit = 'hr.contract'
    _description = 'Employee Contract'

    @api.constrains('date_start', 'date_end', 'state')
    def _check_contracts(self):
        self._get_leaves()._check_contracts()

    def _get_leaves(self):
        return self.env['hr.leave'].search([
            ('state', '!=', 'refuse'),
            ('employee_id', 'in', self.mapped('employee_id.id')),
            ('date_from', '<=', max([end or date.max for end in self.mapped('date_end')])),
            ('date_to', '>=', min(self.mapped('date_start'))),
        ])

    def write(self, vals):
        # Special case when setting a contract as running:
        # If there is already a validated time off over another contract
        # with a different schedule, split the time off, before the
        # _check_contracts raises an issue.
        if 'state' not in vals or vals['state'] != 'open':
            return super().write(vals)
        specific_contracts = self.env['hr.contract']
        all_new_leave_origin = []
        all_new_leave_vals = []
        leaves_state = {}
        for contract in self:
            leaves = contract._get_leaves()
            for leave in leaves:
                overlapping_contracts = leave._get_overlapping_contracts(contract_states=[('state', '!=', 'cancel')])
                if len(overlapping_contracts.resource_calendar_id) <= 1:
                    continue
                if leave.id not in leaves_state:
                    leaves_state[leave.id] = leave.state
                if leave.state != 'refuse':
                    leave.action_refuse()
                super(HrContract, contract).write(vals)
                specific_contracts += contract
                for overlapping_contract in overlapping_contracts:
                    # Exclude other draft contracts that are not set to running on this
                    # transaction
                    if overlapping_contract.state == 'draft' and overlapping_contract not in self:
                        continue
                    new_date_from = max(leave.date_from, datetime.combine(overlapping_contract.date_start, datetime.min.time()))
                    new_date_to = min(leave.date_to, datetime.combine(overlapping_contract.date_end or date.max, datetime.max.time()))
                    new_leave_vals = leave.copy_data({
                        'date_from': new_date_from,
                        'date_to': new_date_to,
                        'state': leaves_state[leave.id],
                    })[0]
                    new_leave = self.env['hr.leave'].new(new_leave_vals)
                    new_leave._compute_date_from_to()
                    new_leave._compute_number_of_days()
                    # Could happen for part-time contract, that time off is not necessary
                    # anymore.
                    if new_leave.date_from < new_leave.date_to:
                        all_new_leave_origin.append(leave)
                        all_new_leave_vals.append(new_leave._convert_to_write(new_leave._cache))
        if all_new_leave_vals:
            new_leaves = self.env['hr.leave'].with_context(
                tracking_disable=True,
                mail_activity_automation_skip=True,
                leave_fast_create=True,
                leave_skip_state_check=True
            ).create(all_new_leave_vals)
            new_leaves.filtered(lambda l: l.state in 'validate')._validate_leave_request()
            for index, new_leave in enumerate(new_leaves):
                new_leave.message_post_with_source(
                    'mail.message_origin_link',
                    render_values={'self': new_leave, 'origin': all_new_leave_origin[index]},
                    subtype_xmlid='mail.mt_note',
                )
        return super(HrContract, self - specific_contracts).write(vals)
