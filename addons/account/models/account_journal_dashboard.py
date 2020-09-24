import json
from datetime import datetime, timedelta
from collections import defaultdict
from babel.dates import format_datetime, format_date
import random
import ast
import copy

from odoo import models, _, api, fields
from odoo.release import version
from odoo.tools import DEFAULT_SERVER_DATE_FORMAT as DF
from odoo.tools.misc import formatLang, format_date as odoo_format_date, get_lang

from odoo.tools.profiler import profile


class account_journal(models.Model):
    _inherit = "account.journal"

    kanban_dashboard = fields.Text(compute='_compute_kanban_dashboard')
    kanban_dashboard_graph = fields.Text(compute='_compute_kanban_dashboard_graph')
    json_activity_data = fields.Text(compute='_compute_json_activity_data')
    show_on_dashboard = fields.Boolean(
        string='Show journal on dashboard',
        help="Whether this journal should be displayed on the dashboard or not",
        default=True,
    )
    color = fields.Integer("Color Index", default=0)

    @api.depends('kanban_dashboard_graph')
    def _compute_kanban_dashboard(self):
        data = self._get_journal_dashboard_datas()
        for journal in self:
            journal.kanban_dashboard = json.dumps(data[journal.id])

    @profile
    def _compute_kanban_dashboard_graph(self):
        bank_and_cash_journal = self.filtered(lambda j: j.type in ('bank', 'cash'))
        sale_and_purchase_journal = self.filtered(lambda j: j.type in ('sale', 'purchase'))
        data = sale_and_purchase_journal._get_bar_graph_datas()
        data.update(bank_and_cash_journal._get_line_graph_datas())
        for journal in self:
            if journal.id in data:
                journal.kanban_dashboard_graph = json.dumps(data[journal.id])
            else:
                journal.kanban_dashboard_graph = False

    def _compute_json_activity_data(self):
        # search activity on move on the journal
        sql_query = '''
               SELECT act.id,
                      act.res_id,
                      act.res_model,
                      act.summary,
                      act_type.name as act_type_name,
                      act_type.category as activity_category,
                      act.date_deadline,
                      m.date,
                      m.ref,
                      m.journal_id,
                      CASE WHEN act.date_deadline < %(today)s
                           THEN 'late'
                           ELSE 'future'
                      END as status
                 FROM account_move m
            LEFT JOIN mail_activity act ON act.res_id = m.id
            LEFT JOIN mail_activity_type act_type ON act.activity_type_id = act_type.id
                WHERE act.res_model = 'account.move'
                  AND m.journal_id IN %(journal_ids)s
        '''
        self.env.cr.execute(sql_query, {
            'journal_ids': tuple(self.ids),
            'today': fields.Date.context_today(self),
        })
        activities_by_jrnl = defaultdict(list)
        for activity in self.env.cr.dictfetchall():
            act = {
                'id': activity.get('id'),
                'res_id': activity.get('res_id'),
                'res_model': activity.get('res_model'),
                'status': activity.get('status'),
                'name': (activity.get('summary') or activity.get('act_type_name')),
                'activity_category': activity.get('activity_category'),
                'date': odoo_format_date(self.env, activity.get('date_deadline'))
            }
            if (
                activity.get('activity_category') == 'tax_report'
                and activity.get('res_model') == 'account.move'
            ):
                act['name'] = activity.get('ref')

            activities_by_jrnl[activity['journal_id']].append(act)
        for journal in self:
            journal.json_activity_data = json.dumps({'activities': activities_by_jrnl[journal.id]})

    def _graph_title_and_key(self):
        if self.type in ['sale', 'purchase']:
            return ['', _('Residual amount')]
        elif self.type == 'cash':
            return ['', _('Cash: Balance')]
        elif self.type == 'bank':
            return ['', _('Bank: Balance')]

    # Below method is used to get data of bank and cash statemens
    def _get_line_graph_datas(self):
        """Compute the data used to display the graph for bank and cash journals in the accounting dashboard."""
        def build_graph_data(date, amount):
            # display date in locale format
            name = format_date(date, 'd LLLL Y', locale=locale)
            short_name = format_date(date, 'd MMM', locale=locale)
            return {'x': short_name, 'y': amount, 'name': name}

        if not self:
            return {}

        today = datetime.today()
        last_month = today + timedelta(days=-30)
        locale = get_lang(self.env).code

        # then we subtract the total amount of bank statement lines per day to get the previous points
        # (graph is drawn backward)
        query = '''
              SELECT move.date, sum(st_line.amount) as amount, move.journal_id
                FROM account_bank_statement_line st_line
                JOIN account_move move ON move.id = st_line.move_id
               WHERE move.journal_id IN %(journal_ids)s
                 AND move.date > %(date_from)s
                 AND move.date <= %(date_to)s
            GROUP BY move.date, move.journal_id
            ORDER BY move.date desc
        '''
        self.env.cr.execute(query, {
            'journal_ids': tuple(self.ids),
            'date_from': last_month,
            'date_to': today,
        })
        query_result = defaultdict(list)
        for result in self.env.cr.dictfetchall():
            query_result[result['journal_id']] += [result]

        graph_data = {}
        for journal in self:
            # starting point of the graph is the last statement
            currency = journal.currency_id or journal.company_id.currency_id
            last_stmt = journal._get_last_bank_statement(domain=[('move_id.state', '=', 'posted')])  # TODO get this out
            last_balance = last_stmt and last_stmt.balance_end_real or 0
            date = today
            amount = last_balance
            data = [build_graph_data(date, amount)]
            for val in query_result[journal.id]:
                date = val['date']
                if date != today.strftime(DF):  # make sure the last point in the graph is today
                    data[:0] = [build_graph_data(date, amount)]
                amount = currency.round(amount - val['amount'])

            # make sure the graph starts 1 month ago
            if date.strftime(DF) != last_month.strftime(DF):
                data[:0] = [build_graph_data(last_month, amount)]

            [graph_title, graph_key] = journal._graph_title_and_key()
            color = '#875A7B' if 'e' in version else '#7c7bad'

            is_sample_data = not last_stmt and len(query_result[journal.id]) == 0
            if is_sample_data:
                data = []
                for i in range(30, 0, -5):
                    current_date = today + timedelta(days=-i)
                    data.append(build_graph_data(current_date, random.randint(-5, 15)))

            graph_data[journal.id] = [{
                'values': data,
                'title': graph_title,
                'key': graph_key,
                'area': True,
                'color': color,
                'is_sample_data': is_sample_data,
            }]

        return graph_data

    def _get_bar_graph_datas(self):
        if not self:
            return {}
        base_data = []
        today = fields.Datetime.now(self)
        base_data.append({'label': _('Due'), 'value': 0.0, 'type': 'past'})
        day_of_week = int(format_datetime(today, 'e', locale=get_lang(self.env).code))
        first_day_of_week = today + timedelta(days=-day_of_week+1)
        for i in range(-1, 4):
            if i == 0:
                label = _('This Week')
            elif i == 3:
                label = _('Not Due')
            else:
                start_week = first_day_of_week + timedelta(days=i*7)
                end_week = start_week + timedelta(days=6)
                if start_week.month == end_week.month:
                    label = '%s-%s %s' % (
                        start_week.day,
                        end_week.day,
                        format_date(end_week, 'MMM', locale=get_lang(self.env).code),
                    )
                else:
                    label = '%s-%s' % (
                        format_date(start_week, 'd MMM', locale=get_lang(self.env).code),
                        format_date(end_week, 'd MMM', locale=get_lang(self.env).code),
                    )
            base_data.append({'label': label, 'value': 0.0, 'type': 'past' if i < 0 else 'future'})

        # Build SQL query to find amount aggregated by week
        query, params = self._get_bar_graph_select_query()
        self.env.cr.execute(query, params)
        query_results = defaultdict(list)
        for result in self.env.cr.dictfetchall():
            query_results[result['journal_id']] += [result]

        graph_data = {}
        for journal in self:
            data = copy.deepcopy(base_data)
            is_sample_data = True
            for index in range(0, len(query_results[journal.id])):
                if query_results[journal.id][index].get('aggr_date') is not None:
                    is_sample_data = False
                    data[index]['value'] = query_results[journal.id][index].get('total')

            [graph_title, graph_key] = journal._graph_title_and_key()

            if is_sample_data:
                for index in range(0, len(query_results[journal.id])):
                    data[index]['type'] = 'o_sample_data'
                    # we use unrealistic values for the sample data
                    data[index]['value'] = random.randint(0, 20)
                    graph_key = _('Sample data')

            graph_data[journal.id] = [{
                'values': data,
                'title': graph_title,
                'key': graph_key,
                'is_sample_data': is_sample_data,
            }]
        return graph_data

    def _get_bar_graph_select_query(self):
        """
        Returns a tuple containing the base SELECT SQL query used to gather
        the bar graph's data as its first element, and the arguments dictionary
        for it as its second.
        """
        return ('''
            WITH period_table(date_start, date_stop, index) AS (VALUES
                (NULL,           %(today)s     , 0),
                (%(today)s,      %(today)s -  7, 1),
                (%(today)s -  7, %(today)s - 14, 2),
                (%(today)s - 14, %(today)s - 21, 3),
                (%(today)s - 21, %(today)s - 28, 4),
                (%(today)s - 28,           NULL, 5)
            )

              SELECT CASE WHEN journal.type = 'sale'
                          THEN SUM(move.amount_residual_signed)
                          ELSE -SUM(move.amount_residual_signed)
                     END AS total,
                     MIN(invoice_date_due) AS aggr_date,
                     journal.id AS journal_id,
                     period_table.index
                FROM account_move move
                JOIN account_journal journal ON move.journal_id = journal.id
                JOIN period_table ON (
                    period_table.date_start IS NULL OR invoice_date_due <= period_table.date_start
                ) AND (
                    period_table.date_stop IS NULL OR invoice_date_due >= period_table.date_stop
                )
               WHERE move.journal_id IN %(journal_ids)s
                 AND move.state = 'posted'
                 AND move.payment_state in ('not_paid', 'partial')
                 AND move.move_type IN %(invoice_types)s
            GROUP BY journal.id, period_table.index
        ''', {
            'invoice_types': tuple(self.env['account.move'].get_invoice_types(True)),
            'journal_ids': tuple(self.ids),
            'today': fields.Date.context_today(self),
        })

    @profile
    def _get_journal_dashboard_datas(self):
        self.env['account.move'].flush(self.env['account.move']._fields)
        self.env['account.move.line'].flush(self.env['account.move.line']._fields)

        bank_and_cash_journal = self.filtered(lambda j: j.type in ('bank', 'cash'))
        if bank_and_cash_journal:
            bank_account_balance_by_journal = bank_and_cash_journal._get_journal_bank_account_balance(domain=[('move_id.state', '=', 'posted')])
            outstanding_pay_account_balance_by_journal = bank_and_cash_journal._get_journal_outstanding_payments_account_balance(domain=[('move_id.state', '=', 'posted')])
            query, query_args = bank_and_cash_journal._get_number_to_reconcile_query()
            self.env.cr.execute(query, query_args)
            number_to_reconcile_by_journal = {
                res['journal_id']: res
                for res in self.env.cr.dictfetchall()
            }
            to_check_ids_by_journal = bank_and_cash_journal.to_check_ids()
        else:
            bank_account_balance_by_journal = outstanding_pay_account_balance_by_journal = number_to_reconcile_by_journal = {}

        sale_and_purchase_journal = self.filtered(lambda j: j.type in ('sale', 'purchase'))
        if sale_and_purchase_journal:
            query, query_args = sale_and_purchase_journal._get_open_bills_to_pay_query()
            self.env.cr.execute(query, query_args)
            query_results_to_pay_by_journal = defaultdict(list)
            for res in self.env.cr.dictfetchall():
                query_results_to_pay_by_journal[res['journal_id']] += [res]
            query, query_args = sale_and_purchase_journal._get_draft_bills_query()
            self.env.cr.execute(query, query_args)
            query_results_drafts_by_journal = defaultdict(list)
            for res in self.env.cr.dictfetchall():
                query_results_drafts_by_journal[res['journal_id']] += [res]
            query, query_args = sale_and_purchase_journal._get_late_query()
            self.env.cr.execute(query, query_args)
            late_query_results_by_journal = defaultdict(list)
            for res in self.env.cr.dictfetchall():
                late_query_results_by_journal[res['journal_id']] += [res]
        else:
            query_results_to_pay_by_journal = query_results_drafts_by_journal = late_query_results_by_journal = {}

        read_to_check = self.env['account.move'].read_group(
            domain=[('journal_id', 'in', self.ids), ('to_check', '=', True)],
            fields=['amount_total'],
            groupby=['journal_id'],
            lazy=False,
        )
        to_check_by_journal = {}
        for read in read_to_check:
            to_check_by_journal[read['journal_id'][0]] = read

        res = {}
        for journal in self:
            currency = journal.currency_id or journal.company_id.currency_id
            number_to_reconcile = number_to_check = last_balance = 0
            has_at_least_one_statement = False
            bank_account_balance = nb_lines_bank_account_balance = 0
            outstanding_pay_account_balance = nb_lines_outstanding_pay_account_balance = 0
            title = ''
            number_draft = number_waiting = number_late = to_check_balance = 0
            sum_draft = sum_waiting = sum_late = 0.0
            if journal.type in ('bank', 'cash'):
                last_statement = journal._get_last_bank_statement(
                    domain=[('move_id.state', '=', 'posted')])
                last_balance = last_statement.balance_end
                has_at_least_one_statement = bool(last_statement)
                bank_account_balance, nb_lines_bank_account_balance = bank_account_balance_by_journal[journal.id]
                outstanding_pay_account_balance, nb_lines_outstanding_pay_account_balance = outstanding_pay_account_balance_by_journal[journal.id]
                number_to_reconcile = number_to_reconcile_by_journal[journal.id]['count']

                to_check_ids = to_check_ids_by_journal.get(journal.id) or self.env['account.bank.statement.line']
                number_to_check = len(to_check_ids)
                to_check_balance = sum([r.amount for r in to_check_ids])
            #TODO need to check if all invoices are in the same currency than the journal!!!!
            elif journal.type in ['sale', 'purchase']:
                title = _('Bills to pay') if journal.type == 'purchase' else _('Invoices owed to you')

                query_results_to_pay = query_results_to_pay_by_journal[journal.id]
                query_results_drafts = query_results_drafts_by_journal[journal.id]
                late_query_results = late_query_results_by_journal[journal.id]
                curr_cache = {}
                (number_waiting, sum_waiting) = self._count_results_and_sum_amounts(query_results_to_pay, currency, curr_cache=curr_cache)
                (number_draft, sum_draft) = self._count_results_and_sum_amounts(query_results_drafts, currency, curr_cache=curr_cache)
                (number_late, sum_late) = self._count_results_and_sum_amounts(late_query_results, currency, curr_cache=curr_cache)
                read = to_check_by_journal.get(journal.id)
                if read:
                    number_to_check = read[0]['__count']
                    to_check_balance = read[0]['amount_total']
            elif journal.type == 'general':
                read = to_check_by_journal.get(journal.id)
                if read:
                    number_to_check = read[0]['__count']
                    to_check_balance = read[0]['amount_total']

            is_sample_data = journal.kanban_dashboard_graph and any(data.get('is_sample_data', False) for data in json.loads(journal.kanban_dashboard_graph))

            res[journal.id] = {
                'number_to_check': number_to_check,
                'to_check_balance': formatLang(self.env, to_check_balance, currency_obj=currency),
                'number_to_reconcile': number_to_reconcile,
                'account_balance': formatLang(self.env, currency.round(bank_account_balance), currency_obj=currency),
                'has_at_least_one_statement': has_at_least_one_statement,
                'nb_lines_bank_account_balance': nb_lines_bank_account_balance,
                'outstanding_pay_account_balance': formatLang(self.env, currency.round(outstanding_pay_account_balance), currency_obj=currency),
                'nb_lines_outstanding_pay_account_balance': nb_lines_outstanding_pay_account_balance,
                'last_balance': formatLang(self.env, currency.round(last_balance) + 0.0, currency_obj=currency),
                'number_draft': number_draft,
                'number_waiting': number_waiting,
                'number_late': number_late,
                'sum_draft': formatLang(self.env, currency.round(sum_draft) + 0.0, currency_obj=currency),
                'sum_waiting': formatLang(self.env, currency.round(sum_waiting) + 0.0, currency_obj=currency),
                'sum_late': formatLang(self.env, currency.round(sum_late) + 0.0, currency_obj=currency),
                'currency_id': currency.id,
                'bank_statements_source': journal.bank_statements_source,
                'title': title,
                'is_sample_data': is_sample_data,
            }
        return res

    def _get_open_bills_to_pay_query(self):
        """
        Returns a tuple containing the SQL query used to gather the open bills
        data as its first element, and the arguments dictionary to use to run
        it as its second.
        """
        return ('''
            SELECT
                (CASE WHEN move.move_type IN ('out_refund', 'in_refund') THEN -1 ELSE 1 END) * move.amount_residual AS amount_total,
                move.currency_id AS currency,
                move.move_type,
                move.invoice_date,
                move.journal_id,
                move.company_id
            FROM account_move move
            WHERE move.journal_id IN %(journal_ids)s
            AND move.state = 'posted'
            AND move.payment_state in ('not_paid', 'partial')
            AND move.move_type IN ('out_invoice', 'out_refund', 'in_invoice', 'in_refund', 'out_receipt', 'in_receipt');
        ''', {'journal_ids': tuple(self.ids)})

    def _get_draft_bills_query(self):
        """
        Returns a tuple containing as its first element the SQL query used to
        gather the bills in draft state data, and the arguments
        dictionary to use to run it as its second.
        """
        return ('''
            SELECT
                (CASE WHEN move.move_type IN ('out_refund', 'in_refund') THEN -1 ELSE 1 END) * move.amount_total AS amount_total,
                move.currency_id AS currency,
                move.move_type,
                move.invoice_date,
                move.journal_id,
                move.company_id
            FROM account_move move
            WHERE move.journal_id IN %(journal_ids)s
            AND move.state = 'draft'
            AND move.payment_state in ('not_paid', 'partial')
            AND move.move_type IN ('out_invoice', 'out_refund', 'in_invoice', 'in_refund', 'out_receipt', 'in_receipt');
        ''', {'journal_ids': tuple(self.ids)})

    def _get_late_query(self):
        return ("""
            SELECT (CASE WHEN move_type IN ('out_refund', 'in_refund') THEN -1 ELSE 1 END) * amount_residual AS amount_total,
                   currency_id AS currency,
                   move_type,
                   invoice_date,
                   journal_id,
                   company_id
              FROM account_move move
             WHERE journal_id IN %(journal_ids)s
               AND date <= %(today)s
               AND state = 'posted'
               AND payment_state in ('not_paid', 'partial')
               AND move_type IN ('out_invoice', 'out_refund', 'in_invoice', 'in_refund', 'out_receipt', 'in_receipt');
        """, {
            'journal_ids': tuple(self.ids),
            'today': fields.Date.context_today(self),
        })

    def _get_number_to_reconcile_query(self):
        return ("""
            SELECT COUNT(st_line.id), st_line_move.journal_id
              FROM account_bank_statement_line st_line
              JOIN account_move st_line_move ON st_line_move.id = st_line.move_id
              JOIN account_bank_statement st ON st_line.statement_id = st.id
             WHERE st_line_move.journal_id IN %(journal_ids)s
               AND st.state = 'posted'
               AND NOT st_line.is_reconciled
             GROUP BY st_line_move.journal_id
        """, {
            'journal_ids': tuple(self.ids),
        })

    @api.model
    def _count_results_and_sum_amounts(self, results_dict, target_currency, curr_cache=None):
        """ Loops on a query result to count the total number of invoices and sum
        their amount_total field (expressed in the given target currency).
        amount_total must be signed !
        """
        rslt_count = 0
        rslt_sum = 0.0
        # Create a cache with currency rates to avoid unnecessary SQL requests. Do not copy
        # curr_cache on purpose, so the dictionary is modified and can be re-used for subsequent
        # calls of the method.
        curr_cache = {} if curr_cache is None else curr_cache
        for result in results_dict:
            cur = self.env['res.currency'].browse(result.get('currency'))
            company = self.env['res.company'].browse(result.get('company_id')) or self.env.company
            rslt_count += 1
            date = result.get('invoice_date') or fields.Date.context_today(self)

            amount = result.get('amount_total', 0) or 0
            if cur != target_currency:
                key = (cur, target_currency, company, date)
                # Using setdefault will call _get_conversion_rate, so we explicitly check the
                # existence of the key in the cache instead.
                if key not in curr_cache:
                    curr_cache[key] = 1#self.env['res.currency']._get_conversion_rate(*key)
                amount *= curr_cache[key]
            rslt_sum += target_currency.round(amount)
        return (rslt_count, rslt_sum)

    #######################
    # Actions and Buttons #
    #######################
    def action_create_new(self):
        ctx = self._context.copy()
        ctx['default_journal_id'] = self.id
        if self.type == 'sale':
            ctx['default_move_type'] = 'out_refund' if ctx.get('refund') else 'out_invoice'
        elif self.type == 'purchase':
            ctx['default_move_type'] = 'in_refund' if ctx.get('refund') else 'in_invoice'
        else:
            ctx['default_move_type'] = 'entry'
            ctx['view_no_maturity'] = True
        return {
            'name': _('Create invoice/bill'),
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'account.move',
            'view_id': self.env.ref('account.view_move_form').id,
            'context': ctx,
        }

    def create_cash_statement(self):
        ctx = self._context.copy()
        ctx.update({'journal_id': self.id, 'default_journal_id': self.id, 'default_journal_type': 'cash'})
        open_statements = self.env['account.bank.statement'].search([('journal_id', '=', self.id), ('state', '=', 'open')])
        action = {
            'name': _('Create cash statement'),
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'account.bank.statement',
            'context': ctx,
        }
        if len(open_statements) == 1:
            action.update({
                'view_mode': 'form',
                'res_id': open_statements.id,
            })
        elif len(open_statements) > 1:
            action.update({
                'view_mode': 'tree,form',
                'domain': [('id', 'in', open_statements.ids)],
            })
        return action

    def to_check_ids(self):
        domain = self.env['account.move.line']._get_suspense_moves_domain()
        domain.append(('journal_id', 'in', self.ids))
        return {
            r['journal_id'][0]: self.env['account.bank.statement.line'].browse(r['statement_line_id'])
            for r in self.env['account.move.line'].read_group(
                domain=domain,
                fields=['statement_line_id:array_agg'],
                groupby=['journal_id']
            )
        }

    def _select_action_to_open(self):
        self.ensure_one()
        if self._context.get('action_name'):
            return self._context.get('action_name')
        elif self.type == 'bank':
            return 'action_bank_statement_tree'
        elif self.type == 'cash':
            return 'action_view_bank_statement_tree'
        elif self.type == 'sale':
            return 'action_move_out_invoice_type'
        elif self.type == 'purchase':
            return 'action_move_in_invoice_type'
        else:
            return 'action_move_journal_line'

    def open_action(self):
        """Return action based on type for related journals."""
        self.ensure_one()
        action_name = self._select_action_to_open()

        # Set 'account.' prefix if missing.
        if '.' not in action_name:
            action_name = 'account.%s' % action_name

        action = self.env["ir.actions.act_window"]._for_xml_id(action_name)

        context = self._context.copy()
        if 'context' in action and type(action['context']) == str:
            context.update(ast.literal_eval(action['context']))
        else:
            context.update(action.get('context', {}))
        action['context'] = context
        action['context'].update({
            'default_journal_id': self.id,
            'search_default_journal_id': self.id,
        })

        # The model can be either account.move or account.move.line
        domain_type_field = action['res_model'] == 'account.move.line' and 'move_id.move_type' or 'move_type'

        # Override the domain only if the action was not explicitly specified in order to keep the
        # original action domain.
        if not self._context.get('action_name'):
            if self.type == 'sale':
                action['domain'] = [(domain_type_field, 'in', ('out_invoice', 'out_refund', 'out_receipt'))]
            elif self.type == 'purchase':
                action['domain'] = [(domain_type_field, 'in', ('in_invoice', 'in_refund', 'in_receipt'))]

        return action

    def open_spend_money(self):
        """Return action to see supplier payments."""
        return self._open_payments_action('outbound')

    def open_collect_money(self):
        """Return action to see customer payments."""
        return self._open_payments_action('inbound')

    def open_transfer_money(self):
        """Return action to see internal transfers."""
        return self._open_payments_action('transfer')

    def create_customer_payment(self):
        """Return action to create a customer payment."""
        return self._open_payments_action('inbound', mode='form')

    def create_supplier_payment(self):
        """Return action to create a supplier payment."""
        return self._open_payments_action('outbound', mode='form')

    def create_internal_transfer(self):
        """Return action to create a internal transfer."""
        return self._open_payments_action('transfer', mode='form')

    def _open_payments_action(self, payment_type, mode='tree'):
        self.ensure_one()
        if payment_type == 'outbound':
            action_ref = 'account.action_account_payments_payable'
        elif payment_type == 'transfer':
            action_ref = 'account.action_account_payments_transfer'
        else:
            action_ref = 'account.action_account_payments'
        [action] = self.env.ref(action_ref).read()
        action['context'] = dict(
            ast.literal_eval(action.get('context')),
            default_journal_id=self.id,
            search_default_journal_id=self.id,
        )
        if payment_type == 'transfer':
            action['context'].update({
                'default_partner_id': self.company_id.partner_id.id,
                'default_is_internal_transfer': True,
            })
        if mode == 'form':
            action['views'] = [[False, 'form']]
        return action

    def open_action_with_context(self):
        action_name = self.env.context.get('action_name', False)
        if not action_name:
            return False
        ctx = dict(self.env.context, default_journal_id=self.id)
        if ctx.get('search_default_journal', False):
            ctx.update(search_default_journal_id=self.id)
        ctx.pop('group_by', None)
        ir_model_obj = self.env['ir.model.data']
        model, action_id = ir_model_obj.get_object_reference('account', action_name)
        [action] = self.env[model].browse(action_id).read()
        action['context'] = ctx
        if ctx.get('use_domain', False):
            action['domain'] = isinstance(ctx['use_domain'], list) and ctx['use_domain'] or ['|', ('journal_id', '=', self.id), ('journal_id', '=', False)]
            action['name'] = _(
                "%(action)s for journal %(journal)s",
                action=action["name"],
                journal=self.name,
            )
        return action

    def create_bank_statement(self):
        """Return action to create a bank statements.

        This button should be called only on journals with type =='bank'
        """
        self.ensure_one()
        return {
            **self.env["ir.actions.actions"]._for_xml_id("account.action_bank_statement_tree"),
            'views': [[False, 'form']],
            'context': {'default_journal_id': self.id},
        }

    #####################
    # Setup Steps Stuff #
    #####################
    def mark_bank_setup_as_done_action(self):
        """Mark the 'bank setup' step as done in the setup bar and in the company."""
        self.company_id.sudo().set_onboarding_step_done('account_setup_bank_data_state')

    def unmark_bank_setup_as_done_action(self):
        """Mark the 'bank setup' step as not done in the setup bar and in the company."""
        self.company_id.account_setup_bank_data_state = 'not_done'
