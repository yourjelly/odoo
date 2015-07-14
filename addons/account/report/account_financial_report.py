# -*- coding: utf-8 -*-

import time

from common_report_header import common_report_header
from openerp import api, models, _


class report_financial(models.AbstractModel, common_report_header):
    _name = 'report.account.report_financial'

    def get_lines(self, data):
        lines = []
        account_obj = self.env['account.account']
        account_report = self.env['account.financial.report'].search([('id', '=', data['account_report_id'][0])])
        report_accounts = account_report.with_context(data['used_context'])._get_children_by_order()
        for report in report_accounts:
            vals = {
                'name': report.name,
                'balance': report.balance * report.sign or 0.0,
                'type': 'report',
                'level': bool(report.style_overwrite) and report.style_overwrite or report.level,
                'account_type': report.account_type or False, #used to underline the financial report balances
            }
            if data['debit_credit']:
                vals['debit'] = report.debit
                vals['credit'] = report.credit
            if data['enable_filter']:
                vals['balance_cmp'] = report.with_context(data['comparison_context']).balance * report.sign or 0.0
            lines.append(vals)
            accounts = []
            if report.display_detail == 'no_detail':
                #the rest of the loop is used to display the details of the financial report, so it's not needed here.
                continue
            if report.account_type == 'accounts' and report.account_ids:
                accounts = report.account_ids
            elif report.account_type == 'account_type' and report.account_type_ids:
                accounts = account_obj.search([('user_type_id','in', [x.id for x in report.account_type_ids])])
            if accounts:
                total = self._compute(accounts)
                for account in accounts:
                    #if there are accounts to display, we add them to the lines with a level equals to their level in
                    #the COA + 1 (to avoid having them with a too low level that would conflicts with the level of data
                    #financial reports for Assets, liabilities...)
                    if report.display_detail == 'detail_flat' and account.type == 'view':
                        continue
                    flag = False
                    balance = 0.00
                    if account.id in total:
                        balance = total[account.id].get('balance')
                        if balance != 0.00:
                            balance = balance * report.sign

                    vals = {
                        'name': account.code + ' ' + account.name,
                        'balance': balance,
                        'type': 'account',
                        'level': report.display_detail == 'detail_with_hierarchy' and 4,
                        'account_type': account.internal_type,
                    }
                    if data['debit_credit']:
                        vals['debit'] = total[account.id].get('debit') if account.id in total else 0.00
                        vals['credit'] = total[account.id].get('credit') if account.id in total else 0.00
                        if not account.company_id.currency_id.is_zero(vals['debit']) or not account.company_id.currency_id.is_zero(vals['credit']):
                            flag = True
                    if not account.company_id.currency_id.is_zero(vals['balance']):
                        flag = True
                    if data['enable_filter']:
                        vals['balance_cmp'] = account.with_context(data['comparison_context']).balance * report.sign or 0.0
                        if not account.company_id.currency_id.is_zero(vals['balance_cmp']):
                            flag = True
                    if flag:
                        lines.append(vals)
        return lines

    @api.multi
    def render_html(self, data):
        report_obj = self.env['report']
        self.model = self._context.get('active_model')
        docs = self.env[self.model].browse(self._context.get('active_id'))
        docargs = {
            'doc_ids': self.ids,
            'doc_model': self.model,
            'data': data['options']['form'],
            'docs': docs,
            'get_lines': self.get_lines,
            'time': time,
            'get_filter': self._get_filter,
            'get_start_date':self._get_start_date,
            'get_end_date':self._get_end_date,
            'get_target_move': self._get_target_move,
        }
        return report_obj.render('account.report_financial', docargs)
