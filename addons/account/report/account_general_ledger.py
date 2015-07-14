# -*- coding: utf-8 -*-

import time
from openerp import api, models, _
from common_report_header import common_report_header


class report_generalledger(models.AbstractModel, common_report_header):
    _name = 'report.account.report_generalledger'

    def _get_sortby(self, data):
        if self.sortby == 'sort_journal_partner':
            return 'Journal & Partner'
        return 'Date'

    def get_accounts(self, accounts):
        res = []
        currency = self.env.user.company_id.currency_id
        for account in accounts:
            self._cr.execute('SELECT count(id) FROM account_move_line WHERE journal_id IN %s AND account_id = %s', (tuple(self.ctx.get('journal_ids')), account.id,))
            num_entry = self._cr.fetchone()[0] or 0
            sold_account = self._sum_balance_account(account)
            self.sold_accounts[account.id] = sold_account
            if self.display_account == 'movement':
                res.append(account)
            elif self.display_account == 'not_zero':
                if not currency.is_zero(currency, sold_account):
                    res.append(account)
            else:
                res.append(account)
        if not res:
            return [account]
        return res

    def _sum_balance_account(self, account):
        move_state = ['draft','posted']
        if self.target_move == 'posted':
            move_state = ['posted','']
        self._cr.execute('SELECT (sum(debit) - sum(credit)) as tot_balance \
                FROM account_move_line l \
                JOIN account_move am ON (am.id = l.move_id) \
                WHERE (l.account_id = %s) \
                AND (am.state IN %s) \
                AND (l.journal_id IN %s)'
                ,(account.id, tuple(move_state), tuple(self.ctx.get('journal_ids'))))
        sum_balance = self._cr.fetchone()[0] or 0.0
        if self.init_balance:
            self._cr.execute('SELECT (sum(debit) - sum(credit)) as tot_balance \
                    FROM account_move_line l \
                    JOIN account_move am ON (am.id = l.move_id) \
                    WHERE (l.account_id = %s) \
                    AND (am.state IN %s) \
                    AND (l.journal_id IN %s) '
                    ,(account.id, tuple(move_state), tuple(self.ctx.get('journal_ids'))))
            # Add initial balance to the result
            sum_balance += self._cr.fetchone()[0] or 0.0
        return sum_balance

    def _sum_debit_account(self, account):
        move_state = ['draft','posted']
        if self.target_move == 'posted':
            move_state = ['posted','']
        self._cr.execute('SELECT sum(debit) \
                FROM account_move_line l \
                JOIN account_move am ON (am.id = l.move_id) \
                WHERE (l.account_id = %s) \
                AND (am.state IN %s) \
                AND (l.journal_id IN %s)'
                ,(account.id, tuple(move_state), tuple(self.ctx.get('journal_ids'))))
        sum_debit = self._cr.fetchone()[0] or 0.0
        if self.init_balance:
            self._cr.execute('SELECT sum(debit) \
                    FROM account_move_line l \
                    JOIN account_move am ON (am.id = l.move_id) \
                    WHERE (l.account_id = %s) \
                    AND (am.state IN %s) \
                    AND (l.journal_id IN %s)'
                    ,(account.id, tuple(move_state), tuple(self.ctx.get('journal_ids'))))
            # Add initial balance to the result
            sum_debit += self._cr.fetchone()[0] or 0.0
        return sum_debit

    def _sum_credit_account(self, account):
        move_state = ['draft','posted']
        if self.target_move == 'posted':
            move_state = ['posted','']
        self._cr.execute('SELECT sum(credit) \
                FROM account_move_line l \
                JOIN account_move am ON (am.id = l.move_id) \
                WHERE (l.account_id = %s) \
                AND (am.state IN %s) \
                AND (l.journal_id IN %s) '
                ,(account.id, tuple(move_state), tuple(self.ctx.get('journal_ids'))))
        sum_credit = self._cr.fetchone()[0] or 0.0
        if self.init_balance:
            self._cr.execute('SELECT sum(credit) \
                    FROM account_move_line l \
                    JOIN account_move am ON (am.id = l.move_id) \
                    WHERE (l.account_id = %s) \
                    AND (am.state IN %s) \
                    AND (l.journal_id IN %s) '
                    ,(account.id, tuple(move_state), tuple(self.ctx.get('journal_ids'))))
            # Add initial balance to the result
            sum_credit += self._cr.fetchone()[0] or 0.0
        return sum_credit

    def _sum_currency_amount_account(self, account):
        self._cr.execute('SELECT sum(l.amount_currency) AS tot_currency \
                FROM account_move_line l \
                WHERE l.account_id = %s AND l.journal_id IN %s' %(account.id, tuple(self.ctx.get('journal_ids'))))
        sum_currency = self._cr.fetchone()[0] or 0.0
        if self.init_balance:
            self._cr.execute('SELECT sum(l.amount_currency) AS tot_currency \
                            FROM account_move_line l \
                            WHERE l.account_id = %s AND l.journal_id IN %s '%(account.id, tuple(self.ctx.get('journal_ids'))))
            sum_currency += self._cr.fetchone()[0] or 0.0
        return sum_currency

    def lines(self, account):
        """ Return all the account_move_line of account with their account code counterparts """
        move_state = ['draft','posted']
        if self.target_move == 'posted':
            move_state = ['posted', '']
        # First compute all counterpart strings for every move_id where this account appear.
        # Currently, the counterpart info is used only in landscape mode
        sql = """
            SELECT m1.move_id,
                array_to_string(ARRAY(SELECT DISTINCT a.code
                                          FROM account_move_line m2
                                          LEFT JOIN account_account a ON (m2.account_id=a.id)
                                          WHERE m2.move_id = m1.move_id
                                          AND m2.account_id<>%%s), ', ') AS counterpart
                FROM (SELECT move_id
                        FROM account_move_line l
                        LEFT JOIN account_move am ON (am.id = l.move_id)
                        WHERE am.state IN %s and l.journal_id IN %s AND l.account_id = %%s GROUP BY move_id) m1
        """% (tuple(move_state), tuple(self.ctx.get('journal_ids')))
        self._cr.execute(sql, (account.id, account.id))
        counterpart_res = self._cr.dictfetchall()
        counterpart_accounts = {}
        for i in counterpart_res:
            counterpart_accounts[i['move_id']] = i['counterpart']
        del counterpart_res

        # Then select all account_move_line of this account
        if self.sortby == 'sort_journal_partner':
            sql_sort='j.code, p.name, l.move_id'
        else:
            sql_sort='l.date, l.move_id'
        sql = """
            SELECT l.id AS lid, l.date AS ldate, j.code AS lcode, l.currency_id,l.amount_currency,l.ref AS lref, l.name AS lname, COALESCE(l.debit,0) AS debit, COALESCE(l.credit,0) AS credit, l.partner_id AS lpartner_id,
            m.name AS move_name, m.id AS mmove_id,
            c.symbol AS currency_code,
            i.id AS invoice_id, i.type AS invoice_type, i.number AS invoice_number,
            p.name AS partner_name
            FROM account_move_line l
            JOIN account_move m on (l.move_id=m.id)
            LEFT JOIN res_currency c on (l.currency_id=c.id)
            LEFT JOIN res_partner p on (l.partner_id=p.id)
            LEFT JOIN account_invoice i on (m.id =i.move_id)
            JOIN account_journal j on (l.journal_id=j.id)
            WHERE l.journal_id IN %s AND m.state IN %s AND l.account_id = %%s ORDER by %s
        """ %(tuple(self.ctx.get('journal_ids')), tuple(move_state), sql_sort)
        self._cr.execute(sql, (account.id,))
        res_lines = self._cr.dictfetchall()
        res_init = []
        if res_lines and self.init_balance:
            #FIXME: replace the label of lname with a string translatable
            sql = """
                SELECT 0 AS lid, '' AS ldate, '' AS lcode, COALESCE(SUM(l.amount_currency),0.0) AS amount_currency, '' AS lref, 'Initial Balance' AS lname, COALESCE(SUM(l.debit),0.0) AS debit, COALESCE(SUM(l.credit),0.0) AS credit, '' AS lpartner_id,
                '' AS move_name, '' AS mmove_id, '' AS currency_code,
                NULL AS currency_id,
                '' AS invoice_id, '' AS invoice_type, '' AS invoice_number,
                '' AS partner_name
                FROM account_move_line l
                LEFT JOIN account_move m on (l.move_id=m.id)
                LEFT JOIN res_currency c on (l.currency_id=c.id)
                LEFT JOIN res_partner p on (l.partner_id=p.id)
                LEFT JOIN account_invoice i on (m.id =i.move_id)
                JOIN account_journal j on (l.journal_id=j.id)
                WHERE l.journal_id IN %s AND m.state IN %s AND l.account_id = %%s
            """ %(tuple(self.ctx.get('journal_ids')), tuple(move_state))
            self._cr.execute(sql, (account.id,))
            res_init = self._cr.dictfetchall()
        res = res_init + res_lines
        account_sum = 0.0
        for l in res:
            l['move'] = l['move_name'] != '/' and l['move_name'] or ('*'+str(l['mmove_id']))
            l['partner'] = l['partner_name'] or ''
            account_sum += l['debit'] - l['credit']
            l['progress'] = account_sum
            l['line_corresp'] = l['mmove_id'] == '' and ' ' or counterpart_accounts[l['mmove_id']].replace(', ',',')
            # Modification of amount Currency
            if l['credit'] > 0:
                if l['amount_currency'] != None:
                    l['amount_currency'] = abs(l['amount_currency']) * -1
            if l['amount_currency'] != None:
                self.tot_currency = self.tot_currency + l['amount_currency']
        return res

    @api.multi
    def render_html(self, data):
        report_obj = self.env['report']
        self.model = self._context.get('active_model')
        docs = self.env[self.model].browse(self._context.get('active_id'))
        self.init_balance = data['options']['form'].get('initial_balance', True)
        self.sold_accounts = {}
        self.tot_currency = 0.0
        self.ctx = data['options']['form'].get('used_context',{}).copy()
        self.sortby = data['options']['form'].get('sortby', 'sort_date')
        self.display_account = data['options']['form']['display_account']
        self.target_move = data['options']['form'].get('target_move', 'all')
        accounts = self.env['account.account'].search([])
        docargs = {
            'doc_ids': self.ids,
            'doc_model': self.model,
            'data': data['options']['form'],
            'docs': docs,
            'time': time,
            'lines': self.lines,
            'get_journal': self._get_journal,
            'get_start_date':self._get_start_date,
            'get_end_date':self._get_end_date,
            'get_sortby': self._get_sortby,
            'get_target_move': self._get_target_move,
            'sum_debit_account': self._sum_debit_account,
            'sum_credit_account': self._sum_credit_account,
            'sum_balance_account': self._sum_balance_account,
            'sum_currency_amount_account': self._sum_currency_amount_account,
            'get_accounts': self.get_accounts(accounts),
        }
        return report_obj.render('account.report_generalledger', docargs)
