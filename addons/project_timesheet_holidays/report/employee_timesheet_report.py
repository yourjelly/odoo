# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, tools
from odoo.osv import expression
from odoo.tools import OrderedSet


class EmployeeTimesheetReport(models.Model):

    _name = "employee.timesheet.report"
    _description = "Employee Timesheet Report"
    _auto = False
    _rec_name = 'date'
    _order = 'date desc'

    date = fields.Date('Date', readonly=True)
    employee_id = fields.Many2one('hr.employee', 'Employee', readonly=True)
    unit_amount = fields.Float("Duration", readonly=True)
    working_hours = fields.Float('Working Hours', readonly=True)
    overtime_duration = fields.Float('Overtime Duration', readonly=True)
    date_group_by = fields.Selection((
        ('day', 'By Day'),
        ('week', 'By Week'),
        ('month', 'By Month'),
        ('quarter', 'By quarter'),
        ('year', 'By Year')
    ), string="Date Group By", readonly=True)

    @api.model
    def read_group(self, domain, fields, groupby, offset=0, limit=None, orderby=False, lazy=True):
        date_group_bys = []
        groupby = [groupby] if isinstance(groupby, str) else list(OrderedSet(groupby))
        for gb in groupby:
            if gb.startswith('date:'):
                date_group_bys.append(gb.split(':')[-1])
        date_domains = []
        for gb in date_group_bys:
            date_domains = expression.OR([date_domains, [('date_group_by', '=', gb)]])
        domain = expression.AND([domain, date_domains])
        res = super().read_group(domain, fields, groupby, offset=offset, limit=limit, orderby=orderby, lazy=lazy)
        return res


    def _select(self):
        query_str = """
            WITH min_max_date_timesheet AS (
                select
                    min(date) AS begin_date ,
                    max(date) AS end_date
                from account_analytic_line
            ),
            employee_total_timesheet AS (
                (SELECT
                    d AS date,
                    CASE
                        WHEN L.holiday_id IS NOT NULL THEN 0 ELSE RC.hours_per_day
                    END AS working_hours,
                    0 as unit_amount,
                    0 as l_unit_amount,
                    0 AS overtime_duration,
                     E.id as id
                       FROM min_max_date_timesheet mm
                        JOIN LATERAL generate_series(mm.begin_date, mm.end_date, '1 day') d ON TRUE
                        LEFT JOIN min_max_date_timesheet tt on tt.begin_date IS NOT NULL
                        LEFT JOIN account_analytic_line L on l.date IS NOT NULL
                        LEFT JOIN hr_employee E on L.employee_id = E.id
                        LEFT JOIN resource_calendar RC on E.resource_calendar_id = RC.id
                        LEFT JOIN resource_resource R ON E.resource_id = R.id
                        WHERE
                            EXTRACT(ISODOW FROM d.date) IN (
                                SELECT A.dayofweek::integer+1 FROM resource_calendar_attendance A WHERE A.calendar_id = R.calendar_id
                            )
                      GROUP BY E.id, RC.ID, R.calendar_id, d, L.holiday_id, L.unit_amount
                        order by d
                ) Union ( SELECT
                        L.date AS date,
                        -L.unit_amount AS working_hours,
                        0 AS unit_amount,
                        L.unit_amount as l_unit_amount,
                        0 as overtime_duration,
                        E.id AS id
                    FROM account_analytic_line L
                        LEFT JOIN hr_employee E ON L.employee_id = E.id
                        LEFT JOIN resource_calendar RC on E.resource_calendar_id = RC.id
                        LEFT JOIN resource_resource R ON E.resource_id = R.id
                        LEFT JOIN resource_calendar_attendance RA ON RA.calendar_id = RC.id
                    where l.holiday_id is not null
                ) Union ( SELECT
                        L.date AS date,
                        0 AS working_hours,
                        l.unit_amount as unit_amount,
                        0 as l_unit_amount,
                        CASE
                            WHEN (L.unit_amount - RC.hours_per_day) > 0  THEN (L.unit_amount - RC.hours_per_day) ELSE 0
                        END AS overtime_duration,
                        E.id as id
                    FROM account_analytic_line L
                        LEFT JOIN hr_employee E ON L.employee_id = E.id
                        LEFT JOIN resource_calendar RC on E.resource_calendar_id = RC.id
                        LEFT JOIN resource_resource R ON E.resource_id = R.id
                        LEFT JOIN resource_calendar_attendance RA ON RA.calendar_id = RC.id
                    where l.holiday_id is null
                )
            ),
        total_timesheet AS (
            (select sum(unit_amount) as unit_amount,
            sum(working_hours) as working_hours,
            count(*) as total_record
            from employee_total_timesheet)
        )
        -- Here we compute all day
        SELECT
            ett.date as date,
            ett.working_hours AS working_hours,
            ett.unit_amount AS unit_amount,
            ett.overtime_duration AS overtime_duration,
            ett.id AS id,
           'day' AS date_group_by
        FROM employee_total_timesheet ett
        UNION ALL
            -- Here we compute week
           SELECT
                date_trunc('week', d) as date,
                et.working_hours AS working_hours,
                et.unit_amount AS unit_amount,
                CASE
                    WHEN
                        (tt.unit_amount - tt.working_hours) > 0
                    THEN (tt.unit_amount - tt.working_hours) / tt.total_record ELSE 0
                END AS overtime_duration,
                et.id AS id,
               'week' AS date_group_by
            FROM employee_total_timesheet et
                JOIN total_timesheet tt on tt.total_record is not null
                JOIN min_max_date_timesheet mm on mm.begin_date is not null and mm.end_date is not null
                JOIN LATERAL generate_series(mm.begin_date, mm.end_date, '1 week') d ON TRUE
            WHERE date_trunc('week', mm.begin_date) <= date_trunc('week', d)
            AND date_trunc('week', mm.end_date) >= date_trunc('week', d)
        UNION ALL
            -- Here we compute month
           SELECT
                date_trunc('month', d) as date,
                et.working_hours AS working_hours,
                et.unit_amount AS unit_amount,
                CASE
                    WHEN
                        (tt.unit_amount - tt.working_hours) > 0
                    THEN (tt.unit_amount - tt.working_hours) / tt.total_record ELSE 0
                END AS overtime_duration,
                et.id AS id,
               'month' AS date_group_by
            FROM employee_total_timesheet et
                JOIN total_timesheet tt on tt.total_record is not null
                JOIN min_max_date_timesheet mm on mm.begin_date is not null and mm.end_date is not null
                JOIN LATERAL generate_series(mm.begin_date, mm.end_date, '1 month') d ON TRUE
            WHERE date_trunc('month', mm.begin_date) <= date_trunc('month', d)
            AND date_trunc('month', mm.end_date) >= date_trunc('month', d)
        UNION ALL
            -- Here we compute 3 month / quarter
            SELECT
                date_trunc('quarter', d) as date,
                et.working_hours AS working_hours,
                et.unit_amount AS unit_amount,
                CASE
                    WHEN
                        (tt.unit_amount - tt.working_hours) > 0
                    THEN (tt.unit_amount - tt.working_hours) / tt.total_record ELSE 0
                END AS overtime_duration,
                et.id AS id,
               'quarter' AS date_group_by
            FROM employee_total_timesheet et
                JOIN total_timesheet tt on tt.total_record is not null
                JOIN min_max_date_timesheet mm on mm.begin_date is not null and mm.end_date is not null
                JOIN LATERAL generate_series(mm.begin_date, mm.end_date, '3 month') d ON TRUE
            WHERE date_trunc('quarter', mm.begin_date) <= date_trunc('quarter', d)
            AND date_trunc('quarter', mm.end_date) >= date_trunc('quarter', d)
        UNION ALL
            -- Here we compute 1 year
            SELECT
                date_trunc('year', d) as date,
                et.working_hours AS working_hours,
                et.unit_amount AS unit_amount,
                CASE
                    WHEN
                        (tt.unit_amount - tt.working_hours) > 0
                    THEN (tt.unit_amount - tt.working_hours) / tt.total_record ELSE 0
                END AS overtime_duration,
                et.id AS id,
               'year' AS date_group_by
            FROM employee_total_timesheet et
                JOIN total_timesheet tt on tt.total_record is not null
                JOIN min_max_date_timesheet mm on mm.begin_date is not null and mm.end_date is not null
                JOIN LATERAL generate_series(mm.begin_date, mm.end_date, '1 year') d ON TRUE
            WHERE date_trunc('year', mm.begin_date) <= date_trunc('year', d)
            AND date_trunc('year', mm.end_date) >= date_trunc('year', d)
        """
        return query_str

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""CREATE or REPLACE VIEW %s as (
            %s
            )""" % (self._table, self._select()))
