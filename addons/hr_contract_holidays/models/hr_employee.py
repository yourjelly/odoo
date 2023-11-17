# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime, time
import pytz

from odoo import models


class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    def write(self, vals):
        res = super().write(vals)
        if vals.get('contract_id'):
            contract = self.env['hr_contract'].browse(vals.get('contract_id'))
            self.transfer_leaves_to(contract)
        return res

    def transfer_leaves_to(self, contract):
        tz_info = pytz.timezone(contract.employee_id.tz)
        datetime_from = tz_info.localize(
            datetime.combine(contract.date_start, time.min()))
        domain = [
            ('employee_id', 'in', self.ids),
            ('date_to', '>', datetime_from),
        ]
        if contract.date_end:
            datetime_to = tz_info.localize(datetime.combine(contract.date_end, time.max()))\
                if contract.date_end else False
            domain += [
                ('date_from', '<', datetime_to),
            ]

        self.env['hr.leave'].search(domain).write({
            'resource_calendar_id': contract.resource_calendar_id.id,
        })
