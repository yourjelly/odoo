# -*- coding: utf-8 -*-

from openerp import _

class common_report_header(object):

    def _compute(self, accounts):
        """ compute the balance, debit and/or credit for the provided
        account ids
        Arguments:
        `query`: additional query filter (as a string)
        `query_params`: parameters for the provided query string
                        (__compute will handle their escaping) as a
                        tuple
        """
        mapping = {
            'balance': "COALESCE(SUM(debit),0) - COALESCE(SUM(credit), 0) as balance",
            'debit': "COALESCE(SUM(debit), 0) as debit",
            'credit': "COALESCE(SUM(credit), 0) as credit",
        }
        #compute for each account the balance/debit/credit from the move lines
        res = {}
        if accounts:
            tables, where_clause, where_params = self.env['account.move.line']._query_get()

            tables = tables.replace('"','') if tables else "account_move_line"
            wheres = [""]
            if where_clause.strip():
                wheres.append(where_clause.strip())
            filters = " AND ".join(wheres)
            request = ("SELECT account_id as id, " +\
                       ', '.join(mapping.values()) +
                       " FROM " + tables +
                       " WHERE account_id IN %s " \
                            + filters +
                       " GROUP BY account_id")
            params = (tuple(accounts._ids),) + tuple(where_params)
            self._cr.execute(request, params)

            for row in self._cr.dictfetchall():
                res[row['id']] = row
        return res


    def _get_start_date(self, data):
        if data.get('date_from', False):
            return data['date_from']
        return ''

    def _get_target_move(self, data):
        if data.get('target_move', False):
            if data['target_move'] == 'all':
                return _('All Entries')
            return _('All Posted Entries')
        return ''

    def _get_end_date(self, data):
        if data.get('date_to', False):
            return data['date_to']
        return ''

    def _get_sortby(self, data):
        raise (_('Error!'), _('Not implemented.'))

    def _get_filter(self, data):
        if data.get('filter', False):
            if data['filter'] == 'filter_date':
                return 'Date'
        return 'No Filters'

    def _get_journal(self, data):
        codes = []
        if data.get('journal_ids', False):
            self._cr.execute('select code from account_journal where id IN %s',(tuple(data['journal_ids']),))
            codes = [x for x, in self._cr.fetchall()]
        return codes
