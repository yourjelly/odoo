# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models
from datetime import datetime
from odoo.osv import expression


class History(models.Model):
    _name = "crm.stage.history"
    _description = "crm stage History"

    user_id = fields.Integer(string='User')
    team_id = fields.Integer('Sales Channel')
    stage_id = fields.Many2one('crm.stage', string='Stage')
    stage_name = fields.Char(string='Stage Name', related='stage_id.name', store=True)
    res_id = fields.Many2one('crm.lead', string='related document')

    @api.multi
    def action_pipeline_analysis(self, filter_domain):
        start_date = datetime.strptime(filter_domain['start_date'], "%m-%d-%Y").strftime('%Y-%m-%d')
        end_date = datetime.strptime(filter_domain['end_date'], "%m-%d-%Y").strftime('%Y-%m-%d')
        domain = [('type', '=', 'opportunity'), ('create_date', '>=', start_date), ('create_date', '<=', end_date), '|', ('active', '=', False), ('active', '=', True)]

        if filter_domain.get('user_id'):
            domain = expression.AND([domain, [('user_id', '=', filter_domain['user_id'])]])
        if filter_domain.get('users'):
            domain = expression.AND([domain, [('user_id', 'in', filter_domain['users'])]])
        if filter_domain.get('user_channel'):
            team_id = self.env['res.users'].search([('id', '=', filter_domain['user_channel'])]).sale_team_id
            domain = expression.AND([domain, [('team_id', '=', team_id.id)]])
        if filter_domain.get('teams'):
            domain = expression.AND([domain, [('team_id', 'in', filter_domain['teams'])]])

        records = self.env['crm.lead'].search(domain)
        total_opp = len(records)
        total_days = 0
        expected_revenues = {}
        opportunity = {
            'won_opp': [],
            'lost_opp': [],
            'opp_to_close': [],
            'opp_to_close_amount': 0,
            'open_opp': 0,
            'opp_overpassed': [],
            'opp_overpassed_amount': 0,
        }

        for record in records:
            if expected_revenues.get(record.stage_id.name):
                expected_revenues[record.stage_id.name] += record.planned_revenue
            else:
                expected_revenues[record.stage_id.name] = record.planned_revenue

            if record.date_closed:
                if record.probability == 100:
                    opportunity['won_opp'].append(record.planned_revenue)
                elif not record.active:
                    opportunity['lost_opp'].append(record.planned_revenue)
            else:
                opportunity['open_opp'] += 1
                if record.date_deadline and record.date_deadline <= datetime.today().strftime('%Y-%m-%d'):
                    opportunity['opp_overpassed'].append(record.id)
                    opportunity['opp_overpassed_amount'] += record.planned_revenue
                elif record.date_deadline and record.date_deadline <= end_date:
                    opportunity['opp_to_close'].append(record.id)
                    opportunity['opp_to_close_amount'] += record.planned_revenue

            if record.day_close:
                total_days += record.day_close
            else:
                day_close = datetime.today() - datetime.strptime(record.create_date, '%Y-%m-%d %H:%M:%S')
                total_days += day_close.days

        if total_days != 0:
            average_days = round(total_days / total_opp)
        else:
            average_days = 0

        stages = self.env['crm.stage'].search_read([], ['name', 'sequence'], order='sequence')
        stage_moves = []
        for stage in stages:
            result = self.env['crm.stage.history'].search_count([('res_id', 'in', records.ids), ('stage_name', '=', stage['name'])])
            if total_opp != 0:
                percentage = (result * 100) / total_opp
            else:
                percentage = 0
            stage_moves.append({'name': stage['name'],
                                'sequence': stage['sequence'],
                                'data': result,
                                'percentage': percentage})

        return {'stage_moves': stage_moves,
                'new_opp': len(records),
                'opportunity': opportunity,
                'average_days': average_days,
                'expected_revenues': expected_revenues.items(),
                'domain': domain}

    def get_value(self, company_id):
        users = self.env['res.users'].search_read([('sale_team_id', '!=', None)], ['name'])
        sales_team = self.env['crm.team'].search_read([], ['name'])
        currency_id = self.env['res.company'].search([('id', '=', company_id)], limit=1).currency_id.id
        return {'users': users,
                'sales_team': sales_team,
                'currency_id': currency_id}
