# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _
from odoo.exceptions import ValidationError


class ResCompany(models.Model):
    _inherit = 'res.company'

    l10n_fr_reference_leave_type = fields.Many2one(
        'hr.leave.type',
        string='Company Paid Time Off Type')
    l10n_fr_holiday_days_type = fields.Selection(
        [
            ('ouvres', 'working days (Mon-Fri)'),
            ('ouvrables', 'business days (Mon-Sat)'),
        ],
        default='ouvrables',
        string='Time off reference days',
        help="""
            Determins wether or not the five saturdays rule should be used.
            The rule is used when business days are selected.
        """)

    def _get_fr_reference_leave_type(self):
        self.ensure_one()
        if not self.l10n_fr_reference_leave_type:
            raise ValidationError(_("You must first define a reference time off type for the company."))
        return self.l10n_fr_reference_leave_type
