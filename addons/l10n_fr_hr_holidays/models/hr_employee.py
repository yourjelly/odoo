# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    l10n_fr_saturday_counts = fields.One2many('l10n.fr.saturday.followup', 'employee_id')

    def update_saturdays(self, date_from, new_date_from, count, new_count):
        self.ensure_one()
        if date_from.year != new_date_from.year:
            self.remove_saturdays(new_date_from, new_count)
            real_count = self.add_saturdays(new_date_from, new_count)
            return real_count
        count_diff = new_count - count
        if count_diff >= 0:
            real_count = count + self.add_saturdays(new_date_from, count_diff)
            return real_count
        saturday_counter = self.l10n_fr_saturday_counts.filtered(lambda sc: sc.year == date_from.year)
        saturday_counter.count = max(0, saturday_counter.count + count_diff)
        real_count = min(new_count, saturday_counter.count)
        return real_count

    def add_saturdays(self, date_from, count):
        self.ensure_one()
        real_count = count
        if count > 5:
            real_count = 5
        saturday_counter = self.l10n_fr_saturday_counts.filtered(lambda sc: sc.year == date_from.year)
        if not saturday_counter:
            saturday_counter = self.env['l10n.fr.saturday.followup'].create([{
                'employee_id': self.id,
                'year': date_from.year,
                'count': real_count,
            }])
            return real_count
        if saturday_counter.count + real_count > 5:
            real_count = 5 - saturday_counter.count
            saturday_counter.count = 5
            return real_count
        saturday_counter.count += real_count
        return real_count

    def remove_saturdays(self, date_from, count):
        self.ensure_one()
        saturday_counter = self.l10n_fr_saturday_counts.filtered(lambda sc: sc.year == date_from.year)
        if saturday_counter:
            saturday_counter.count = max(0, saturday_counter.count - count)

    def get_saturday_counts(self, date_from):
        saturday_counts = {}
        for employee in self:
            saturday_counts[employee] = employee.l10n_fr_saturday_counts.filtered(lambda sc: sc.year == date_from.year)

