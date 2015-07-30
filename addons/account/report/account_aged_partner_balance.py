# -*- coding: utf-8 -*-

import time
from openerp import api, models, _
from common_report_header import common_report_header


class report_agedpartnerbalance(models.AbstractModel, common_report_header):

    _name = 'report.account.report_agedpartnerbalance'

    # def set_context(self, objects, data, ids, report_type=None):
    #     obj_move = self.pool.get('account.move.line')
    #     ctx = data['form'].get('used_context', {})
    #     ctx.update({'fiscalyear': False, 'all_fiscalyear': True})
    #     self.query = obj_move._query_get(self.cr, self.uid, obj='l', context=ctx)
    #     self.direction_selection = data['form'].get('direction_selection', 'past')
    #     self.target_move = data['form'].get('target_move', 'all')
    #     self.date_from = data['form'].get('date_from', time.strftime('%Y-%m-%d'))
    #     if (data['form']['result_selection'] == 'customer' ):
    #         self.ACCOUNT_TYPE = ['receivable']
    #     elif (data['form']['result_selection'] == 'supplier'):
    #         self.ACCOUNT_TYPE = ['payable']
    #     else:
    #         self.ACCOUNT_TYPE = ['payable','receivable']
    #     return super(aged_trial_report, self).set_context(objects, data, ids, report_type=report_type)

    def _get_lines(self, form):
        res = []
        move_state = ['draft','posted']
        if self.target_move == 'posted':
            move_state = ['posted']


        r = ("SELECT DISTINCT res_partner.id AS id,\
                    res_partner.name AS name \
                FROM res_partner, account_account, " + self.tables +
                " WHERE (account_move_line.account_id=account_account.id) \
                    AND (account_account.internal_type IN %s)\
                    AND ((account_move_line.reconciled = False)\
                       )\
                    AND (account_move_line.partner_id=res_partner.id) " + self.filters + 
                " ORDER BY res_partner.name")
        print"\n\n\rrrr...",r
        p = (tuple(self.ACCOUNT_TYPE), ) + tuple(self.where_params)
        print"\n\np...",p
        self._cr.execute(r, p)
        partners = self._cr.dictfetchall()
        ## mise a 0 du total
        for i in range(7):
            self.total_account.append(0)
        #
        # Build a string like (1,2,3) for easy use in SQL query
        partner_ids = [x['id'] for x in partners]
        if not partner_ids:
            return []
        # This dictionary will store the debit-credit for all partners, using partner_id as key.

        totals = {}






        r = ("SELECT account_move_line.partner_id, SUM(account_move_line.debit-account_move_line.credit) \
                    FROM account_account, " + self.tables + 
                    " WHERE (account_move_line.account_id = account_account.id) AND (account_move_line.move_id=account_move_line__move_id.id) \
                    -- AND (am.state IN %s)\
                    AND (account_account.internal_type IN %s)\
                  --  AND (l.partner_id IN %s)\
                    AND ((account_move_line.reconcile_id = False)\
                    AND (l.date <= %s)" + self.filters + 
                    " GROUP BY account_move_line.partner_id ")
        print"\n\n\rrrr...",r
        p = (tuple(self.ACCOUNT_TYPE), ) + tuple(self.where_params)





        self._cr.execute(r, p)
        t = self._cr.fetchall()
        for i in t:
            totals[i[0]] = i[1]

        # This dictionary will store the future or past of all partners
        future_past = {}
        if self.direction_selection == 'future':
            self._cr.execute('SELECT l.partner_id, SUM(l.debit-l.credit) \
                        FROM account_move_line AS l, account_account, account_move am \
                        WHERE (l.account_id=account_account.id) AND (l.move_id=am.id) \
                        AND (am.state IN %s)\
                        AND (account_account.type IN %s)\
                        AND (COALESCE(l.date_maturity, l.date) < %s)\
                        AND (l.partner_id IN %s)\
                        AND ((l.reconcile_id IS NULL)\
                        OR (l.reconcile_id IN (SELECT recon.id FROM account_move_reconcile AS recon WHERE recon.create_date > %s )))\
                        AND '+ self.query + '\
                        AND account_account.active\
                    AND (l.date <= %s)\
                        GROUP BY l.partner_id', (tuple(move_state), tuple(self.ACCOUNT_TYPE), self.date_from, tuple(partner_ids),self.date_from, self.date_from,))
            t = self._cr.fetchall()
            for i in t:
                future_past[i[0]] = i[1]
        elif self.direction_selection == 'past': # Using elif so people could extend without this breaking
            self._cr.execute('SELECT l.partner_id, SUM(l.debit-l.credit) \
                    FROM account_move_line AS l, account_account, account_move am \
                    WHERE (l.account_id=account_account.id) AND (l.move_id=am.id)\
                        AND (am.state IN %s)\
                        AND (account_account.type IN %s)\
                        AND (COALESCE(l.date_maturity,l.date) > %s)\
                        AND (l.partner_id IN %s)\
                        AND ((l.reconcile_id IS NULL)\
                        OR (l.reconcile_id IN (SELECT recon.id FROM account_move_reconcile AS recon WHERE recon.create_date > %s )))\
                        AND '+ self.query + '\
                        AND account_account.active\
                    AND (l.date <= %s)\
                        GROUP BY l.partner_id', (tuple(move_state), tuple(self.ACCOUNT_TYPE), self.date_from, tuple(partner_ids), self.date_from, self.date_from,))
            t = self._cr.fetchall()
            for i in t:
                future_past[i[0]] = i[1]

        # Use one query per period and store results in history (a list variable)
        # Each history will contain: history[1] = {'<partner_id>': <partner_debit-credit>}
        history = []
        for i in range(5):
            args_list = (tuple(move_state), tuple(self.ACCOUNT_TYPE), tuple(partner_ids),self.date_from,)
            dates_query = '(COALESCE(l.date_maturity,l.date)'
            if form[str(i)]['start'] and form[str(i)]['stop']:
                dates_query += ' BETWEEN %s AND %s)'
                args_list += (form[str(i)]['start'], form[str(i)]['stop'])
            elif form[str(i)]['start']:
                dates_query += ' >= %s)'
                args_list += (form[str(i)]['start'],)
            else:
                dates_query += ' <= %s)'
                args_list += (form[str(i)]['stop'],)
            args_list += (self.date_from,)
            self._cr.execute('''SELECT l.partner_id, SUM(l.debit-l.credit), l.reconcile_partial_id
                    FROM account_move_line AS l, account_account, account_move am 
                    WHERE (l.account_id = account_account.id) AND (l.move_id=am.id)
                        AND (am.state IN %s)
                        AND (account_account.type IN %s)
                        AND (l.partner_id IN %s)
                        AND ((l.reconcile_id IS NULL)
                          OR (l.reconcile_id IN (SELECT recon.id FROM account_move_reconcile AS recon WHERE recon.create_date > %s )))
                        AND ''' + self.query + '''
                        AND account_account.active
                        AND ''' + dates_query + '''
                    AND (l.date <= %s)
                    GROUP BY l.partner_id, l.reconcile_partial_id''', args_list)
            partners_partial = self.cr.fetchall()
            partners_amount = dict((i[0],0) for i in partners_partial)
            for partner_info in partners_partial:
                if partner_info[2]:
                    # in case of partial reconciliation, we want to keep the left amount in the oldest period
                    self._cr.execute('''SELECT MIN(COALESCE(date_maturity,date)) FROM account_move_line WHERE reconcile_partial_id = %s''', (partner_info[2],))
                    date = self.cr.fetchall()
                    partial = False
                    if 'BETWEEN' in dates_query:
                        partial = date and args_list[-3] <= date[0][0] <= args_list[-2]
                    elif '>=' in dates_query:
                        partial = date and date[0][0] >= form[str(i)]['start']
                    else:
                        partial = date and date[0][0] <= form[str(i)]['stop']
                    if partial:
                        # partial reconcilation
                        limit_date = 'COALESCE(l.date_maturity,l.date) %s %%s' % '<=' if self.direction_selection == 'past' else '>='
                        self.cr.execute('''SELECT SUM(l.debit-l.credit)
                                           FROM account_move_line AS l, account_move AS am
                                           WHERE l.move_id = am.id AND am.state in %s
                                           AND l.reconcile_partial_id = %s
                                           AND ''' + limit_date, (tuple(move_state), partner_info[2], self.date_from))
                        unreconciled_amount = self.cr.fetchall()
                        partners_amount[partner_info[0]] += unreconciled_amount[0][0]
                else:
                    partners_amount[partner_info[0]] += partner_info[1]
            history.append(partners_amount)

        for partner in partners:
            values = {}
            ## If choise selection is in the future
            if self.direction_selection == 'future':
                # Query here is replaced by one query which gets the all the partners their 'before' value
                before = False
                if future_past.has_key(partner['id']):
                    before = [ future_past[partner['id']] ]
                self.total_account[6] = self.total_account[6] + (before and before[0] or 0.0)
                values['direction'] = before and before[0] or 0.0
            elif self.direction_selection == 'past': # Changed this so people could in the future create new direction_selections
                # Query here is replaced by one query which gets the all the partners their 'after' value
                after = False
                if future_past.has_key(partner['id']): # Making sure this partner actually was found by the query
                    after = [ future_past[partner['id']] ]

                self.total_account[6] = self.total_account[6] + (after and after[0] or 0.0)
                values['direction'] = after and after[0] or 0.0

            for i in range(5):
                during = False
                if history[i].has_key(partner['id']):
                    during = [ history[i][partner['id']] ]
                # Ajout du compteur
                self.total_account[(i)] = self.total_account[(i)] + (during and during[0] or 0)
                values[str(i)] = during and during[0] or 0.0
            total = False
            if totals.has_key( partner['id'] ):
                total = [ totals[partner['id']] ]
            values['total'] = total and total[0] or 0.0
            ## Add for total
            self.total_account[(i+1)] = self.total_account[(i+1)] + (total and total[0] or 0.0)
            values['name'] = partner['name']

            res.append(values)

        total = 0.0
        totals = {}
        for r in res:
            total += float(r['total'] or 0.0)
            for i in range(5)+['direction']:
                totals.setdefault(str(i), 0.0)
                totals[str(i)] += float(r[str(i)] or 0.0)
        return res

    def _get_lines_with_out_partner(self, form):
        res = []
        move_state = ['draft','posted']
        if self.target_move == 'posted':
            move_state = ['posted']

        ## mise a 0 du total
        for i in range(7):
            self.total_account.append(0)
        totals = {}
        self._cr.execute('SELECT SUM(account_move_line.debit-account_move_line.credit) from account_account, ' + self.tables + 
                    ' WHERE (account_move_line.account_id = account_account.id) AND (account_move_line.move_id=account_move_line__move_id.id)\
                    -- AND (am.state IN %s)\
                    AND (account_move_line.partner_id IS NULL)\
                    AND (account_account.internal_type IN %s)\
                    AND ((account_move_line.reconciled = False) \
                    AND (account_move_line.date <= %s)',(tuple(self.ACCOUNT_TYPE), self.date_from, self.date_from,))
        t = self._cr.fetchall()
        for i in t:
            totals['Unknown Partner'] = i[0]
        future_past = {}
        if self.direction_selection == 'future':
            self._cr.execute('SELECT SUM(l.debit-l.credit) \
                        FROM account_move_line AS l, account_account, account_move am\
                        WHERE (l.account_id=account_account.id) AND (l.move_id=am.id)\
                        AND (am.state IN %s)\
                        AND (l.partner_id IS NULL)\
                        AND (account_account.type IN %s)\
                        AND (COALESCE(l.date_maturity, l.date) < %s)\
                        AND ((l.reconcile_id IS NULL)\
                        OR (l.reconcile_id IN (SELECT reconself.id FROM account_move_reconcile AS recon WHERE recon.create_date > %s )))\
                        AND '+ self.query + '\
                        AND account_account.active ', (tuple(move_state), tuple(self.ACCOUNT_TYPE), self.date_from, self.date_from))
            t = self._cr.fetchall()
            for i in t:
                future_past['Unknown Partner'] = i[0]
        elif self.direction_selection == 'past': # Using elif so people could extend without this breaking
            print"tableeeee....",self.tables        
            r = ('SELECT SUM(debit - credit) FROM account_account, ' + self.tables + 
                    ' WHERE (account_move_line.account_id=account_account.id)\
                        AND (account_move_line.partner_id IS NULL)\
                        AND (account_account.internal_type IN %s)\
                        AND (COALESCE(account_move_line.date_maturity,account_move_line.date) > %s)\
                        AND ((account_move_line.reconciled = False))' + self.filters)
            print"\n\nr......",r  
            p = (tuple(self.ACCOUNT_TYPE), self.date_from) + tuple(self.where_params)
#            p =  (tuple(self.ACCOUNT_TYPE), self.date_from) + + tuple(self.where_params)
            print'pppprms...',p                      
            self._cr.execute( r, p)
            t = self._cr.fetchall()
            for i in t:
                future_past['Unknown Partner'] = i[0]
        history = []

        for i in range(5):
            args_list = (tuple(self.ACCOUNT_TYPE), self.date_from,)
            dates_query = '(COALESCE(account_move_line.date_maturity,account_move_line.date)'
            if form[str(i)]['start'] and form[str(i)]['stop']:
                dates_query += ' BETWEEN %s AND %s)'
                args_list += (form[str(i)]['start'], form[str(i)]['stop'])
            elif form[str(i)]['start']:
                dates_query += ' > %s)'
                args_list += (form[str(i)]['start'],)
            else:
                dates_query += ' < %s)'
                args_list += (form[str(i)]['stop'],)
            #args_list += (self.date_from,)
            print"\n\n\n>>>>>>args_list....",args_list
            self._cr.execute('SELECT SUM(debit- credit)\
                    FROM account_account,  ' + self.tables +
                    ' WHERE (account_move_line.account_id = account_account.id)\
                        AND (account_account.internal_type IN %s)\
                        AND (account_move_line.partner_id IS NULL)\
                        AND ((account_move_line.reconciled = False))\
                        AND ' + dates_query + '\
                    AND (account_move_line.date <= %s)\
                    GROUP BY account_move_line.partner_id', args_list)
                    #todo - recheck this query again
            t = self._cr.fetchall()
            d = {}
            for i in t:
                d['Unknown Partner'] = i[0]
            history.append(d)

        values = {}
        if self.direction_selection == 'future':
            before = False
            if future_past.has_key('Unknown Partner'):
                before = [ future_past['Unknown Partner'] ]
            self.total_account[6] = self.total_account[6] + (before and before[0] or 0.0)
            values['direction'] = before and before[0] or 0.0
        elif self.direction_selection == 'past':
            after = False
            if future_past.has_key('Unknown Partner'):
                after = [ future_past['Unknown Partner'] ]
            self.total_account[6] = self.total_account[6] + (after and after[0] or 0.0)
            values['direction'] = after and after[0] or 0.0

        for i in range(5):
            during = False
            if history[i].has_key('Unknown Partner'):
                during = [ history[i]['Unknown Partner'] ]
            self.total_account[(i)] = self.total_account[(i)] + (during and during[0] or 0)
            values[str(i)] = during and during[0] or 0.0

        total = False
        if totals.has_key( 'Unknown Partner' ):
            total = [ totals['Unknown Partner'] ]
        values['total'] = total and total[0] or 0.0
        ## Add for total
        self.total_account[(i+1)] = self.total_account[(i+1)] + (total and total[0] or 0.0)
        values['name'] = 'Unknown Partner'

        if values['total']:
            res.append(values)

        total = 0.0
        totals = {}
        for r in res:
            total += float(r['total'] or 0.0)
            for i in range(5)+['direction']:
                totals.setdefault(str(i), 0.0)
                totals[str(i)] += float(r[str(i)] or 0.0)
        return res

    def _get_total(self,pos):
        period = self.total_account[int(pos)]
        return period or 0.0

    def _get_direction(self,pos):
        period = self.total_account[int(pos)]
        return period or 0.0

    def _get_for_period(self,pos):
        period = self.total_account[int(pos)]
        return period or 0.0

    def _get_partners(self,data):
        # TODO: deprecated, to remove in trunk
        if data['form']['result_selection'] == 'customer':
            return self._translate('Receivable Accounts')
        elif data['form']['result_selection'] == 'supplier':
            return self._translate('Payable Accounts')
        elif data['form']['result_selection'] == 'customer_supplier':
            return self._translate('Receivable and Payable Accounts')
        return ''


    @api.multi
    def render_html(self, data):
        print"\n\n\n\ninside...............renderrrrrrr"
        self.total_account = []
        report_obj = self.env['report']
        self.model = self._context.get('active_model')
        MoveLine = self.env['account.move.line']
        docs = self.env[self.model].browse(self._context.get('active_id'))
        print"\n\n\n\ndaaaataaaaa...",data['options']['form']
        self.ctx = data['options']['form'].get('used_context',{}).copy()
        self.tables, self.where_clause, self.where_params = MoveLine.with_context(self.ctx)._query_get()
        print ">>tables>>>>>>>>>>>>>>",self.tables
        print"\n\nelf.where_clause",self.where_clause, "\n\n\nself.where_params",self.where_params
        
        
        
        
        
        
        self.tables = self.tables.replace('"','') if self.tables else "account_move_line"
        self.wheres = [""]
        if self.where_clause.strip():
            self.wheres.append(self.where_clause.strip())
        self.filters = " AND ".join(self.wheres)
        print"filtrrrss",self.filters

        
        
        
        
        
        
        
        self.direction_selection = data['options']['form'].get('direction_selection', 'past')
        self.target_move = data['options']['form'].get('target_move', 'all')
        self.date_from = data['options']['form'].get('date_from', time.strftime('%Y-%m-%d'))
        if (data['options']['form']['result_selection'] == 'customer' ):
            self.ACCOUNT_TYPE = ['receivable']
        elif (data['options']['form']['result_selection'] == 'supplier'):
            self.ACCOUNT_TYPE = ['payable']
        else:
            self.ACCOUNT_TYPE = ['payable','receivable']

        docargs = {
            'doc_ids': self.ids,
            'doc_model': self.model,
            'data': data['options']['form'],
            'docs': docs,
            'time': time,
            'get_lines_with_out_partner': self._get_lines_with_out_partner,
            'get_lines': self._get_lines,
            'get_total': self._get_total,
            'get_start_date':self._get_start_date,
            'get_direction': self._get_direction,
            'get_for_period': self._get_for_period,
          #  'get_company': self.env.user.company_id.name,
            #'get_currency': self._get_currency,
            'get_partners':self._get_partners,
            'get_target_move': self._get_target_move,
        }
        print"\n\n\ndocargs",docargs
        return report_obj.render('account.report_agedpartnerbalance', docargs)

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:

