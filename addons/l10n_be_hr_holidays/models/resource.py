# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime
import time
from odoo import models

class CalendarLeaves(models.Model):
    _inherit = "resource.calendar.leaves"

    def generate_public_leaves(self):
        work_entry_type_id = self.env.ref("l10n_be_hr_payroll.work_entry_type_bank_holiday")
        public_leaves = [
            {"name":"New Year's Day", "date_from":time.strftime('%Y-01-01 05:00:00'), "date_to": time.strftime('%Y-01-01 19:00:00'), "work_entry_type_id":work_entry_type_id.id},
            {"name":"Labour Day", "date_from":time.strftime('%Y-05-01 05:00:00'), "date_to": time.strftime('%Y-05-01 19:00:00'), "work_entry_type_id":work_entry_type_id.id},
            {"name":"National Holiday", "date_from":time.strftime('%Y-07-21 05:00:00'), "date_to": time.strftime('%Y-07-21 19:00:00'), "work_entry_type_id":work_entry_type_id.id},
            {"name":"Assumption", "date_from":time.strftime('%Y-08-15 05:00:00'), "date_to": time.strftime('%Y-08-15 19:00:00'), "work_entry_type_id":work_entry_type_id.id},
            {"name":"All Saints", "date_from":time.strftime('%Y-11-01 05:00:00'), "date_to": time.strftime('%Y-11-01 19:00:00'), "work_entry_type_id":work_entry_type_id.id},
            {"name":"Armistice", "date_from":time.strftime('%Y-11-11 05:00:00'), "date_to": time.strftime('%Y-11-11 19:00:00'), "work_entry_type_id":work_entry_type_id.id},
            {"name":"Christmas", "date_from":time.strftime('%Y-12-25 05:00:00'), "date_to": time.strftime('%Y-12-25 19:00:00'), "work_entry_type_id":work_entry_type_id.id},
        ]
        companies = self.env.company.search([])
        be_companies = companies.filtered(lambda x: x.country_id.code == "BE")
        for be_company in be_companies:
            existing_leaves = self.env['resource.calendar.leaves'].search([('company_id', '=', be_company.id)])
            existing_leaves_dates = [
                leave.date_from.date().strftime('%Y-%m-%d') for leave in existing_leaves
            ]
            new_leaves = [
                public_leave
                for public_leave in public_leaves
                if datetime.strptime(public_leave['date_from'], '%Y-%m-%d %H:%M:%S').date().strftime('%Y-%m-%d')
                not in existing_leaves_dates
            ]
            if new_leaves:
                self.env["resource.calendar.leaves"].with_company(be_company).create(new_leaves)
