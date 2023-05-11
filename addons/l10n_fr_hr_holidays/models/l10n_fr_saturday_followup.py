# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class l10nFrSaturdayFollowup(models.Model):
    _name = 'l10n.fr.saturday.followup'

    year = fields.Integer()
    employee_id = fields.Many2one('hr.employee')
    count = fields.Integer(default=0, readonly=True,
        help="Amount of saturdays taken for that allocation according to the 5 saturdays rule.")

    _sql_constraints = [
        ('l10n_fr_five_saturdays',
        'l10n_fr_saturday_used BETWEEN 0 AND 5',
        'The limit to used saturdays for an allocation should be between 0 and 5.'),
        ('l10n_fr_unique_year_employee',
        'UNIQUE(year, employee_id)',
        'There can be only one record per year and per employee.')]
