# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from dateutil.relativedelta import relativedelta

from odoo import api, fields, models
from odoo.tools import format_amount
from odoo.tools.misc import formatLang

class ProjectUpdate(models.Model):
    _inherit = 'project.update'

    @api.model
    def _get_template_values(self, project_id):
        return {
            **super(ProjectUpdate, self)._get_template_values(project_id),
            'profitability': self._get_profitability_values(project_id=project_id),
        }

    @api.model
    def _get_profitability_values(self, project_id):
        today = fields.Date.context_today(self)
        a_month_ago = fields.Date.context_today(self) + relativedelta(months=-1)
        two_month_ago = fields.Date.context_today(self) + relativedelta(months=-2)
        profitability = self.env['project.profitability.report'].read_group(
            [('project_id', '=', project_id)],
            ['project_id',
             'amount_untaxed_to_invoice',
             'amount_untaxed_invoiced',
             'expense_amount_untaxed_to_invoice',
             'expense_amount_untaxed_invoiced',
             'other_revenues',
             'expense_cost',
             'timesheet_cost',
             'margin'],
            ['project_id'])
        costs = profitability[0]['timesheet_cost'] + profitability[0]['expense_cost']
        revenues = (profitability[0]['amount_untaxed_invoiced'] + profitability[0]['amount_untaxed_to_invoice'] +
                    profitability[0]['expense_amount_untaxed_invoiced'] + profitability[0]['expense_amount_untaxed_to_invoice'] +
                    profitability[0]['other_revenues'])
        timesheet_billable = 0.0
        timesheet_total = 0.0
        timesheet_groups = self.env['account.analytic.line'].read_group([('project_id', '=', project_id)], ['unit_amount', 'timesheet_invoice_type'], ['timesheet_invoice_type'])
        for timesheet_group in timesheet_groups:
            timesheet_total += timesheet_group['unit_amount']
            if timesheet_group['timesheet_invoice_type'] not in ('non_billable_timesheet', 'non_billable_project', 'non_billable'):
                timesheet_billable += timesheet_group['unit_amount']
        timesheets_this_month = self.env['project.profitability.report'].read_group(
            [('project_id', '=', project_id),
             ('line_date', '>=', a_month_ago)],
            ['project_id',
             'timesheet_unit_amount'],
            ['project_id'])
        timesheets_previous_month = self.env['project.profitability.report'].read_group(
            [('project_id', '=', project_id),
             ('line_date', '>=', two_month_ago),
             ('line_date', '<', a_month_ago)
             ],
            ['project_id',
             'timesheet_unit_amount'],
            ['project_id'])
        timesheet_unit_amount = timesheets_this_month and timesheets_this_month[0]['timesheet_unit_amount'] or 0.0
        previous_timesheet_unit_amount = timesheets_previous_month and timesheets_previous_month[0]['timesheet_unit_amount'] or 0.0
        return {
            'month': today.strftime('%B %Y'),
            'previous_month': a_month_ago.strftime('%B %Y'),
            'is_timesheet_uom_hour': self.env.company._is_timesheet_hour_uom(),
            'timesheet_uom': self.env.company._timesheet_uom_text(),
            'timesheet_unit_amount': timesheet_unit_amount,
            'previous_timesheet_unit_amount': previous_timesheet_unit_amount,
            'timesheet_trend': formatLang(self.env, previous_timesheet_unit_amount > 0 and ((timesheet_unit_amount / previous_timesheet_unit_amount) - 1) * 100 or 0.0),
            'costs': format_amount(self.env, costs, self.env.company.currency_id),
            'revenues': format_amount(self.env, revenues, self.env.company.currency_id),
            'margin': profitability[0]['margin'],
            'margin_formatted': format_amount(self.env, profitability[0]['margin'], self.env.company.currency_id),
            'margin_percentage': formatLang(self.env, costs > 0 and -(profitability[0]['margin'] / costs) * 100 or 0.0),
            'billing_rate': formatLang(self.env, timesheet_total > 0 and timesheet_billable / timesheet_total * 100 or 0.0),
        }
