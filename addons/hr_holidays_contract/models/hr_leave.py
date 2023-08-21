# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import api, models, _
from odoo.exceptions import ValidationError
from odoo.osv.expression import AND
from odoo.tools import format_date


class HrLeave(models.Model):
    _inherit = 'hr.leave'

    def _get_overlapping_contracts(self, contract_states=None):
        self.ensure_one()
        if contract_states is None:
            contract_states = [
                '|',
                ('state', 'not in', ['draft', 'cancel']),
                '&',
                ('state', '=', 'draft'),
                ('kanban_state', '=', 'done')
            ]
        domain = AND([contract_states, [
            ('employee_id', '=', self.employee_id.id),
            ('date_start', '<=', self.date_to),
            '|',
                ('date_end', '>=', self.date_from),
                '&',
                    ('date_end', '=', False),
                    ('state', '!=', 'close')
        ]])
        return self.env['hr.contract'].sudo().search(domain)

    @api.constrains('date_from', 'date_to')
    def _check_contracts(self):
        """
            A leave cannot be set across multiple contracts.
            Note: a leave can be across multiple contracts despite this constraint.
            It happens if a leave is correctly created (not across multiple contracts) but
            contracts are later modifed/created in the middle of the leave.
        """
        for holiday in self.filtered('employee_id'):
            contracts = holiday._get_overlapping_contracts()
            if len(contracts.resource_calendar_id) > 1:
                state_labels = {e[0]: e[1] for e in contracts._fields['state']._description_selection(self.env)}
                raise ValidationError(
                    _("""A leave cannot be set across multiple contracts with different working schedules.

Please create one time off for each contract.

Time off:
%s

Contracts:
%s""",
                      holiday.display_name,
                      '\n'.join(_(
                          "Contract %s from %s to %s, status: %s",
                          contract.name,
                          format_date(self.env, contract.date_start),
                          format_date(self.env, contract.date_start) if contract.date_end else _("undefined"),
                          state_labels[contract.state]
                      ) for contract in contracts)))


    def _get_number_of_days(self, date_from, date_to, employee):
        """ If an employee is currently working full time but asks for time off next month
            where he has a new contract working only 3 days/week. This should be taken into
            account when computing the number of days for the leave (2 weeks leave = 6 days).
            Override this method to get number of days according to the contract's calendar
            at the time of the leave.
        """
        days = super()._get_number_of_days(date_from, date_to, employee)
        if employee:
            # Use sudo otherwise base users can't compute number of days
            contracts = employee.sudo()._get_contracts(date_from, date_to, states=['open', 'close'])
            contracts |= employee.sudo()._get_incoming_contracts(date_from, date_to)
            calendar = contracts[:1].resource_calendar_id if contracts else None # Note: if len(contracts)>1, the leave creation will crash because of unicity constaint
            # We force the company in the domain as we are more than likely in a compute_sudo
            domain = [('company_id', 'in', self.env.company.ids + self.env.context.get('allowed_company_ids', []))]
            result = employee._get_work_days_data_batch(date_from, date_to, calendar=calendar, domain=domain)[employee.id]
            if self.request_unit_half and result['hours'] > 0:
                result['days'] = 0.5
            return result

        return days

    def _get_calendar(self):
        self.ensure_one()
        if self.date_from and self.date_to:
            contracts = self.employee_id.sudo()._get_contracts(self.date_from, self.date_to, states=['open', 'close'])
            contracts |= self.employee_id.sudo()._get_incoming_contracts(self.date_from, self.date_to)
            contract_calendar = contracts[:1].resource_calendar_id if contracts else None
            return contract_calendar or self.employee_id.resource_calendar_id or self.env.company.resource_calendar_id
        return super()._get_calendar()
