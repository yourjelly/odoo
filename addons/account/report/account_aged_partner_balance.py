# -*- coding: utf-8 -*-

import time
from openerp import api, models, _
from openerp.tools import float_is_zero
from datetime import datetime, timedelta


class ReportAgedPartnerBalance(models.AbstractModel):

    _name = 'report.account.report_agedpartnerbalance'

    def _get_partner_move_lines(self, form, account_type, date_from, target_move):
        res = []
        self.total_account = []

        currency_id = self.env.user.company_id.currency_id
        tables, where_clause, where_params = self.env['account.move.line'].with_context(
            date_to=date_from,
            state=target_move,
        )._query_get("[('account_id.internal_type', 'in', " + str(account_type) + ")]")
        query = """WITH latest_reconcile AS (SELECT date(max(pr.create_date)) date, l.id
                        FROM account_partial_reconcile pr, account_move_line l
                        WHERE pr.debit_move_id = l.id
                        OR pr.credit_move_id = l.id
                        GROUP BY l.id)
        SELECT "account_move_line".partner_id, "account_move_line".date_maturity,
        SUM(CASE
                WHEN GREATEST(d1.date, d2.date, d3.date) > %%s THEN "account_move_line".balance
                ELSE "account_move_line".amount_residual
            END) total
        FROM %s
        LEFT JOIN (SELECT date(max(latest_reconcile.date)) date, l.id
            FROM account_move_line l
            LEFT JOIN account_partial_reconcile pr ON l.id = pr.debit_move_id
            LEFT JOIN latest_reconcile ON latest_reconcile.id = pr.credit_move_id
                GROUP BY l.id
            ) d1 ON d1.id = "account_move_line".id
        LEFT JOIN (SELECT date(max(latest_reconcile.date)) date, l.id
            FROM account_move_line l
            LEFT JOIN account_partial_reconcile pr ON l.id = pr.credit_move_id
            LEFT JOIN latest_reconcile ON latest_reconcile.id = pr.debit_move_id
                GROUP BY l.id
            ) d2 ON d2.id = "account_move_line".id
        LEFT JOIN latest_reconcile as d3 ON d3.id = "account_move_line".id
        WHERE %s
        GROUP BY "account_move_line".partner_id, "account_move_line".date_maturity
        ORDER BY "account_move_line".date_maturity DESC"""
        query = query % (tables, where_clause)
        self.env.cr.execute(query, [date_from] + where_params)
        data = self.env.cr.fetchall()
        results = {'total': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]}
        period_index = 0
        next_pivot_date = date_from
        for partner, date, total in data:
            if currency_id.is_zero(total):
                continue
            while date <= next_pivot_date:
                period_index += 1
                if period_index == 4:
                    next_pivot_date = False
                else:
                    delta = timedelta(days=30)
                    old_date = datetime.strptime(next_pivot_date, "%Y-%m-%d")
                    new_date = old_date - delta
                    next_pivot_date = new_date.strftime("%Y-%m-%d")
            if partner not in results:
                results[partner] = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
            results[partner][period_index] += total
            results['total'][period_index] += total

        total = []
        for partner_id, totals in results.items():
            if partner_id == 'total':
                total = totals
                total[6] = sum(totals)
            else:
                partner = self.env['res.partner'].browse(partner_id)
                totals[6] = sum(totals)
                res.append({
                    'name': partner.name and len(partner.name) >= 45 and partner.name[0:40] + '...' or partner.name,
                    'totals': totals,
                })
        return res, total

    @api.multi
    def render_html(self, data):
        self.total_account = []
        model = self.env.context.get('active_model')
        docs = self.env[model].browse(self.env.context.get('active_id'))

        target_move = data['form'].get('target_move', 'all')
        date_from = data['form'].get('date_from', time.strftime('%Y-%m-%d'))

        if data['form']['result_selection'] == 'customer':
            account_type = ['receivable']
        elif data['form']['result_selection'] == 'supplier':
            account_type = ['payable']
        else:
            account_type = ['payable', 'receivable']

        movelines, total = self._get_partner_move_lines(data['form'], account_type, date_from, target_move)
        docargs = {
            'doc_ids': self.ids,
            'doc_model': model,
            'data': data['form'],
            'docs': docs,
            'time': time,
            'get_partner_lines': movelines,
            'total': total,
        }
        return self.env['report'].render('account.report_agedpartnerbalance', docargs)
