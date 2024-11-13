# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class HrDepartureWizard(models.TransientModel):
    _description = 'Departure Wizard'

    def _get_employee_departure_date(self):
        return self.env['hr.employee'].browse(self.env.context['active_id']).departure_date

    def _get_default_departure_date(self):
        departure_date = False
        if self.env.context.get('active_id'):
            departure_date = self._get_employee_departure_date()
        return departure_date or fields.Date.today()

    departure_reason_id = fields.Many2one("hr.departure.reason", required=True,
        domain=lambda self: self._get_departure_reason_domain(),
        default=lambda self: self.env['hr.departure.reason'].search(self._get_departure_reason_domain(), limit=1),
    )
    departure_description = fields.Html(string="Additional Information")
    departure_date = fields.Date(string="Departure Date", required=True, default=_get_default_departure_date)
    employee_id = fields.Many2one(
        'hr.employee', string='Employee', required=True,
        default=lambda self: self.env.context.get('active_id', None),
    )

    def _get_departure_reason_domain(self):
        allowed_companies = self.env['res.company'].browse(self.env.context.get('allowed_company_ids', []))
        return self.env['hr.departure.reason']._country_domain(allowed_companies.mapped('country_code'))
#         ret = self.env['hr.departure.reason']._country_domain(allowed_companies.mapped('country_code'))
#         print(ret)
#         breakpoint()
#         return ret

    def action_register_departure(self):
        employee = self.employee_id
        if self.env.context.get('employee_termination', False) and employee.active:
            employee.with_context(no_wizard=True).action_archive()
        employee.departure_reason_id = self.departure_reason_id
        employee.departure_description = self.departure_description
        employee.departure_date = self.departure_date
