# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _


class User(models.Model):
    _inherit = ['res.users']

    vehicle = fields.Char(related="employee_id.vehicle")
    bank_account_id = fields.Many2one(related="employee_id.bank_account_id")

    @property
    def SELF_READABLE_FIELDS(self):
        return super().SELF_READABLE_FIELDS + ['vehicle', 'bank_account_id']

    def _get_calendar_of_period(self, date_from=None, date_to=None):
        calendar = super()._get_calendar_of_period()
        if self.employee_id:
            if not date_from or not date_to:
                # Then we take the current contract of this user
                calendar = {(date_from, date_to): self.employee_id.contract_id.resource_calendar_id}
            else:  # Then we search the active contract(s) during the interval between date_from and date_to
                contracts = self.employee_id._get_contracts()
                if len(contracts.resource_calendar_id) > 1:
                    calendar = {(date_from, date_to): contracts.resource_calendar_id}
                else:
                    calendar = {
                        (
                            contract.date_begin if contract.date_begin > date_from else date_from,
                            contract.date_end if contract.date_end < date_to else date_to
                        ): contract.resource_calendar_id for contract in contracts
                    }
        return calendar
