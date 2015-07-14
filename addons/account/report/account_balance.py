# -*- coding: utf-8 -*-

import time

from openerp import api, models, _
from common_report_header import common_report_header


class report_trialbalance(models.AbstractModel, common_report_header):
    _name = 'report.account.report_trialbalance'

    @api.multi
    def _process(self, form):
        ctx = self._context.copy()
        self.result_acc = []

        ctx['date_from'] = form['date_from'] 
        ctx['date_to'] =  form['date_to']
        ctx['state'] = form['target_move']
        accounts = self.env['account.account'].with_context(ctx).search([])
        data = self._compute(accounts)
        for account in accounts:
            currency = account.currency_id and account.currency_id or account.company_id.currency_id
            res = {
                'id': account.id,
                'internal_type': account.internal_type,
                'code': account.code,
                'name': account.name,
                'bal_type': '',
                'debit': data[account.id].get('debit') if account.id in data else 0.00,
                'credit': data[account.id].get('credit') if account.id in data else 0.00,
                'balance': data[account.id].get('balance') if account.id in data else 0.00,
            }
            if form['display_account'] == 'movement':
                if not currency.is_zero(res['credit']) or not currency.is_zero(res['debit']) or not currency.is_zero(res['balance']):
                    self.result_acc.append(res)
            elif form['display_account'] == 'not_zero':
                if not currency.is_zero(res['balance']):
                    self.result_acc.append(res)
            else:
                self.result_acc.append(res)

    def lines(self, form):
        self._process(form)
        return self.result_acc


    @api.multi
    def render_html(self, data):
        report_obj = self.env['report']
        line_obj = self.env['account.move.line']
        self.model = self._context.get('active_model')
        docs = self.env[self.model].browse(self._context.get('active_id'))

        docargs = {
            'doc_ids': self.ids,
            'doc_model': self.model,
            'data': data['options']['form'],
            'docs': docs,
            'time': time,
            'lines': self.lines,
            'get_start_date': self._get_start_date,
            'get_end_date': self._get_end_date,
            'get_target_move': self._get_target_move,
        }
        return report_obj.render('account.report_trialbalance', docargs)
