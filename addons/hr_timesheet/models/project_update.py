# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

class ProjectUpdate(models.Model):
    _inherit = 'project.update'

    @api.model
    def _get_template_values(self, project_id):
        return {
            **super(ProjectUpdate, self)._get_template_values(project_id),
            'people': self._get_people_values(project_id=project_id),
        }

    @api.model
    def _get_people_values(self, project_id):
        return {
            'uom': self.env.company._timesheet_uom_text(),
            'is_uom_hour': self.env.company._is_timesheet_hour_uom(),
            'activities': self._get_activities(project_id)
        }

    @api.model
    def _get_activities(self, project_id):
        query = """
                SELECT timesheet.employee_id as employee_id,
                       gs as period,
                       sum(timesheet.unit_amount) as unit_amount
                  FROM project_project p
            INNER JOIN account_analytic_line timesheet
                    ON timesheet.project_id = p.id
            CROSS JOIN generate_series(
                        (now() at time zone 'utc')::date - '6 month'::interval,
                        (now() at time zone 'utc')::date,
                        '1 month'::interval
                       ) gs
                 WHERE p.id = %(project_id)s
                   AND gs >= timesheet.date
                   AND gs - '1 month'::interval < timesheet.date
              GROUP BY timesheet.employee_id,
                       gs
              ORDER BY gs DESC
        """
        self.env.cr.execute(query, {'project_id': project_id})
        results = self.env.cr.dictfetchall()
        activities = dict()
        for result in results:
            if result['employee_id'] in activities:
                if activities[result['employee_id']]['new']:
                    activities[result['employee_id']]['new'] = False
            else:
                if result['period'] == fields.Datetime.today():
                    activities[result['employee_id']] = {
                        'name': self.env['hr.employee'].browse(result['employee_id']).name,
                        'unit_amount': result['unit_amount'],
                        'worked': result['unit_amount'] > 0,
                        'new': True,
                    }
                else:
                    activities[result['employee_id']] = {
                        'name': self.env['hr.employee'].browse(result['employee_id']).name,
                        'unit_amount': 0,
                        'worked': False,
                        'new': False,
                    }
        return list(activities.values())
