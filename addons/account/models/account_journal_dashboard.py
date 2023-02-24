import ast
from babel.dates import format_datetime, format_date
from collections import defaultdict
from datetime import datetime, timedelta
from dataclasses import dataclass
import json
from typing import Callable
import random

from odoo import models, api, _, fields
from odoo.exceptions import UserError
from odoo.osv import expression
from odoo.release import version
from odoo.tools import DEFAULT_SERVER_DATE_FORMAT as DF
from odoo.tools.misc import formatLang, format_date as odoo_format_date, get_lang, frozendict


def group_by_journal(vals_list):
    res = defaultdict(list)
    for vals in vals_list:
        res[vals['journal_id']].append(vals)
    return res

@dataclass
class ValueGetter:
    alias: str
    value: str
    domain: list
    groupby: set = frozenset({'journal_id'})
    accumulator: Callable[[float, float, dict], float] = lambda val, acc, grouping: val + acc



class account_journal(models.Model):
    _inherit = "account.journal"

    kanban_dashboard_binary = fields.Binary(compute='_compute_kanban_dashboard', exportable=False)
    kanban_dashboard = fields.Text(compute='_kanban_dashboard')
    kanban_dashboard_graph = fields.Text(compute='_kanban_dashboard_graph')
    json_activity_data = fields.Text(compute='_get_json_activity_data')
    show_on_dashboard = fields.Boolean(string='Show journal on dashboard', help="Whether this journal should be displayed on the dashboard or not", default=True)
    color = fields.Integer("Color Index", default=0)
    entries_count = fields.Integer(compute='_compute_entries_count')
    has_sequence_holes = fields.Boolean(compute='_compute_has_sequence_holes')

    def _compute_kanban_dashboard(self):
        query_res = self._query_dashboard_fields()
        for journal in self:
            journal.kanban_dashboard_binary = query_res.get(journal.id, {})

    @api.depends('kanban_dashboard_binary')
    def _kanban_dashboard(self):
        self._compute_kanban_dashboard()
        if self.user_has_groups('account.group_account_readonly'):
            # TODO this should probably be a custo on the prod...
            # Do not bother checking weird global access rights if you have
            # access to move lines.
            # This is the entry point of the dashboard computation, so basically
            # everything will be executed with sudo.
            self = self.sudo()
        dashboard_data = self._get_journal_dashboard_data_batched()
        for journal in self:
            journal.kanban_dashboard = json.dumps(dashboard_data[journal.id])

    @api.depends('kanban_dashboard')
    def _kanban_dashboard_graph(self):
        for journal in self:
            journal.kanban_dashboard_graph = json.dumps(json.loads(journal.kanban_dashboard).get('graph_data', {}))

    def _get_json_activity_data(self):
        activities = defaultdict(list)
        # search activity on move on the journal
        sql_query = '''
            SELECT activity.id,
                   activity.res_id,
                   activity.res_model,
                   activity.summary,
                   CASE WHEN activity.date_deadline < CURRENT_DATE THEN 'late' ELSE 'future' END as status,
                   act_type.name as act_type_name,
                   act_type.category as activity_category,
                   activity.date_deadline,
                   move.date,
                   move.ref,
                   move.journal_id
              FROM account_move move
              JOIN mail_activity activity ON activity.res_id = move.id AND activity.res_model = 'account.move'
         LEFT JOIN mail_activity_type act_type ON activity.activity_type_id = act_type.id
             WHERE move.journal_id = ANY(%s)
        '''
        self.env.cr.execute(sql_query, (self.ids,))
        for activity in self.env.cr.dictfetchall():
            act = {
                'id': activity['id'],
                'res_id': activity['res_id'],
                'res_model': activity['res_model'],
                'status': activity['status'],
                'name': activity['summary'] or activity['act_type_name'],
                'activity_category': activity['activity_category'],
                'date': odoo_format_date(self.env, activity['date_deadline'])
            }
            if activity['activity_category'] == 'tax_report' and activity['res_model'] == 'account.move':
                act['name'] = activity['ref']

            activities[activity['journal_id']].append(act)
        for journal in self:
            journal.json_activity_data = json.dumps({'activities': activities[journal.id]})

    def _query_has_sequence_holes(self):
        self.env.cr.execute("""
            SELECT move.journal_id,
                   move.sequence_prefix
              FROM account_move move
              JOIN res_company company ON company.id = move.company_id
             WHERE move.journal_id = ANY(%(journal_ids)s)
               AND move.state = 'posted'
               AND (company.fiscalyear_lock_date IS NULL OR move.date >= company.fiscalyear_lock_date)
          GROUP BY move.journal_id, move.sequence_prefix
            HAVING COUNT(*) != MAX(move.sequence_number) - MIN(move.sequence_number) + 1
        """, {
            'journal_ids': self.ids,
        })
        return self.env.cr.fetchall()

    def _compute_has_sequence_holes(self):
        has_sequence_holes = set(journal_id for journal_id, _prefix in self._query_has_sequence_holes())
        for journal in self:
            journal.has_sequence_holes = journal.id in has_sequence_holes

    def _compute_entries_count(self):
        res = {
            r['journal_id'][0]: r['journal_id_count']
            for r in self.env['account.move']._read_group(
                domain=[('journal_id', 'in', self.ids)],
                fields=['journal_id'],
                groupby=['journal_id'],
            )
        }
        for journal in self:
            journal.entries_count = res.get(journal.id, 0)

    def _graph_title_and_key(self):
        if self.type in ['sale', 'purchase']:
            return ['', _('Residual amount')]
        elif self.type == 'cash':
            return ['', _('Cash: Balance')]
        elif self.type == 'bank':
            return ['', _('Bank: Balance')]

    def get_line_graph_datas(self):
        self.ensure_one()
        return self._get_line_graph_data_batched()[self.id]

    def _get_line_graph_data_batched(self):
        """Computes the data used to display the graph for bank and cash journals in the accounting dashboard"""
        def build_graph_data(date, amount, currency):
            #display date in locale format
            name = format_date(date, 'd LLLL Y', locale=locale)
            short_name = format_date(date, 'd MMM', locale=locale)
            return {'x': short_name, 'y': currency.round(amount), 'name': name}

        today = datetime.today()
        last_month = today + timedelta(days=-30)
        locale = get_lang(self.env).code

        query = """
            SELECT move.journal_id,
                   move.date,
                   SUM(st_line.amount) AS amount
              FROM account_bank_statement_line st_line
              JOIN account_move move ON move.id = st_line.move_id
             WHERE move.journal_id = ANY(%s)
               AND move.date > %s
               AND move.date <= %s
          GROUP BY move.date, move.journal_id
          ORDER BY move.date DESC
        """
        self.env.cr.execute(query, (self.ids, last_month, today))
        query_result = group_by_journal(self.env.cr.dictfetchall())

        last_statements = self._get_last_bank_statement_batched(
            domain=[('move_id.state', '=', 'posted')],
        )

        result = {}
        for journal in self:
            graph_title, graph_key = journal._graph_title_and_key()
            currency = journal.currency_id or journal.company_id.currency_id
            journal_result = query_result[journal.id]

            color = '#875A7B' if 'e' in version else '#7c7bad'
            #starting point of the graph is the last statement
            last_stmt = last_statements[journal.id]

            last_balance = last_stmt.balance_end_real

            data = []
            data.append(build_graph_data(today, last_balance, currency))
            date = today
            amount = last_balance
            #then we subtract the total amount of bank statement lines per day to get the previous points
            #(graph is drawn backward)
            for val in journal_result:
                date = val['date']
                if date != today.strftime(DF):  # make sure the last point in the graph is today
                    data[:0] = [build_graph_data(date, amount, currency)]
                amount -= val['amount']

            # make sure the graph starts 1 month ago
            if date.strftime(DF) != last_month.strftime(DF):
                data[:0] = [build_graph_data(last_month, amount, currency)]

            is_sample_data = not last_stmt and len(journal_result) == 0
            if is_sample_data:
                data = []
                for i in range(30, 0, -5):
                    current_date = today + timedelta(days=-i)
                    data.append(build_graph_data(current_date, random.randint(-5, 15), currency))

            result[journal.id] = [{'values': data, 'title': graph_title, 'key': graph_key, 'area': True, 'color': color, 'is_sample_data': is_sample_data}]
        return result

    def _get_dashboard_fields(self):
        today = fields.Date.today()
        day_of_week = int(format_datetime(today, 'e', locale=get_lang(self.env).code))
        first_day_of_week = today + timedelta(days=-day_of_week+1)
        posted = [('state', '=', 'posted')]
        draft = [('state', '=', 'draft')]
        unpaid = [('payment_state', 'in', ('not_paid', 'partial'))]
        invoice = [('move_type', 'in', self.env['account.move'].get_invoice_types(True))]
        return [
            ValueGetter(
                alias='total_before',
                value='SUM(account_move.amount_residual_signed)',
                domain=invoice + posted + unpaid + [('invoice_date_due', '<', first_day_of_week + timedelta(days=-7))],
            ),
            ValueGetter(
                alias='total_week1',
                value='SUM(account_move.amount_residual_signed)',
                domain=invoice + posted + unpaid + [('invoice_date_due', '>=', first_day_of_week + timedelta(days=-7)), ('invoice_date_due', '<', first_day_of_week + timedelta(days=0))],
            ),
            ValueGetter(
                alias='total_week2',
                value='SUM(account_move.amount_residual_signed)',
                domain=invoice + posted + unpaid + [('invoice_date_due', '>=', first_day_of_week + timedelta(days=0)), ('invoice_date_due', '<', first_day_of_week + timedelta(days=7))],
            ),
            ValueGetter(
                alias='total_week3',
                value='SUM(account_move.amount_residual_signed)',
                domain=invoice + posted + unpaid + [('invoice_date_due', '>=', first_day_of_week + timedelta(days=7)), ('invoice_date_due', '<', first_day_of_week + timedelta(days=14))],
            ),
            ValueGetter(
                alias='total_week4',
                value='SUM(account_move.amount_residual_signed)',
                domain=invoice + posted + unpaid + [('invoice_date_due', '>=', first_day_of_week + timedelta(days=14)), ('invoice_date_due', '<', first_day_of_week + timedelta(days=21))],
            ),
            ValueGetter(
                alias='total_after',
                value='SUM(account_move.amount_residual_signed)',
                domain=invoice + posted + unpaid + [('invoice_date_due', '>=', first_day_of_week + timedelta(days=21))],
            ),
            ValueGetter(
                alias='entries_count',
                value='COUNT(*)',
                domain=invoice,
            ),
            ValueGetter(
                alias='number_draft',
                value='COUNT(*)',
                domain=invoice + unpaid + draft,
            ),
            ValueGetter(
                alias='sum_draft_currency',
                value="SUM((CASE WHEN account_move.move_type IN ('out_refund', 'in_refund') THEN -1 ELSE 1 END) * account_move.amount_residual)",
                domain=invoice + unpaid + draft,
                groupby={'journal_id', 'currency_id', 'invoice_date'},
                accumulator=lambda v, acc, g: v + acc,
            ),
            ValueGetter(
                alias='sum_draft',
                value='SUM(account_move.amount_residual_signed)',
                domain=invoice + unpaid + draft,
                groupby={'journal_id', 'currency_id', 'invoice_date'},
                accumulator=lambda v, acc, g: v + acc,
            ),
            ValueGetter(
                alias='number_waiting',
                value='COUNT(*)',
                domain=invoice + unpaid + posted,
            ),
            ValueGetter(
                alias='sum_waiting_currency',
                value="SUM((CASE WHEN account_move.move_type IN ('out_refund', 'in_refund') THEN -1 ELSE 1 END) * account_move.amount_residual)",
                domain=invoice + unpaid + posted,
                groupby={'journal_id', 'currency_id', 'invoice_date'},
                accumulator=lambda v, acc, g: v + acc,
            ),
            ValueGetter(
                alias='sum_waiting',
                value='SUM(account_move.amount_residual_signed)',
                domain=invoice + unpaid + posted,
                groupby={'journal_id', 'currency_id', 'invoice_date'},
                accumulator=lambda v, acc, g: v + acc,
            ),
            ValueGetter(
                alias='number_late',
                value='COUNT(*)',
                domain=invoice + unpaid + posted + [('invoice_date_due', '<', fields.Date.context_today(self))],
            ),
            ValueGetter(
                alias='sum_late_currency',
                value="SUM((CASE WHEN account_move.move_type IN ('out_refund', 'in_refund') THEN -1 ELSE 1 END) * account_move.amount_residual)",
                domain=invoice + unpaid + posted + [('invoice_date_due', '<', fields.Date.context_today(self))],
                groupby={'journal_id', 'currency_id', 'invoice_date'},
                accumulator=lambda v, acc, g: v + acc,
            ),
            ValueGetter(
                alias='sum_late',
                value='SUM(account_move.amount_residual_signed)',
                domain=invoice + unpaid + posted + [('invoice_date_due', '<', fields.Date.context_today(self))],
                groupby={'journal_id', 'currency_id', 'invoice_date'},
                accumulator=lambda v, acc, g: v + acc,
            ),
            ValueGetter(
                alias='number_to_check',
                value='COUNT(*)',
                domain=[('to_check', '=', True)],
            ),
            ValueGetter(
                alias='to_check_balance',
                value='SUM(account_move.amount_total)',
                domain=[('to_check', '=', True)],
            ),
            ValueGetter(
                alias='number_to_reconcile',
                value='COUNT(*)',
                domain=posted + [('to_check', '=', False), ('statement_line_id.is_reconciled', '=', False)]
            ),
        ]

    def _query_dashboard_fields(self):
        from pprint import pprint
        getters = self._get_dashboard_fields()
        for getter in getters:
            getter.domain += [('id', '<', '10000')]
        select_list, param_list = [], []
        grouping_sets = set()
        getter_by_mask = defaultdict(list)
        for getter in getters:
            where_clause, params = self.env['account.move']._where_calc(getter.domain).get_sql()[1:]
            select_list.append(f"COALESCE({getter.value} FILTER (WHERE {where_clause}), 0) AS {getter.alias}")
            param_list.extend(params)
            grouping_sets.add(frozenset(getter.groupby))
        sorted_grouping_keys = sorted(set(f for gb in grouping_sets for f in gb))
        # print(sorted_grouping_keys)
        for getter in getters:
            mask = sum(i*2 for i, k in enumerate(sorted_grouping_keys[::-1]) if k not in getter.groupby)
            getter_by_mask[mask].append(getter)

        global_domain = expression.OR(getter.domain for getter in getters)
        from_clause, where_clause, params = self.env['account.move']._where_calc(global_domain).get_sql()
        param_list.extend(params)
        query_str = f"""
            SELECT {', '.join('account_move.%s' % f for f in sorted_grouping_keys)},
                   GROUPING({', '.join('account_move.%s' % f for f in sorted_grouping_keys)}),
                   {', '.join(select_list)}
              FROM {from_clause}
             WHERE {where_clause}
          GROUP BY GROUPING SETS ({', '.join('(%s)' % ', '.join('account_move.%s' % g for g in gs) for gs in grouping_sets)})
        """
        self.env.cr.execute("EXPLAIN ANALYZE " + query_str, param_list)
        print('\n'.join(f for (f,) in self.env.cr.fetchall()))
        # print(self.env.cr.mogrify(query_str, param_list).decode())
        self.env.cr.execute(query_str, param_list)
        result = defaultdict(dict)
        for res in self.env.cr.dictfetchall():
            grouping = res.pop('grouping')
            journal_id = res['journal_id']
            group_vals = {k: res.pop(k) for k in sorted_grouping_keys}
            for getter in getter_by_mask[grouping]:
                result[journal_id][getter.alias] = getter.accumulator(
                    res[getter.alias],
                    result[journal_id].get(getter.alias, 0),
                    group_vals,
                )
        # pprint(result)
        return result

    def get_bar_graph_datas(self):
        self.ensure_one()
        return self._get_bar_graph_datas_batched()[self.id]

    def _get_bar_graph_datas_batched(self):
        today = fields.Date.today()
        day_of_week = int(format_datetime(today, 'e', locale=get_lang(self.env).code))
        first_day_of_week = today + timedelta(days=-day_of_week+1)
        format_month = lambda d: format_date(d, 'MMM', locale=get_lang(self.env).code)

        result = {}
        for journal in self:
            graph_title, graph_key = journal._graph_title_and_key()
            sign = 1 if journal.type == 'sale' else -1
            journal_data = journal.kanban_dashboard_binary
            data = []
            data.append({'label': _('Due'), 'type': 'past'})
            for i in range(-1, 3):
                if i == 0:
                    label = _('This Week')
                else:
                    start_week = first_day_of_week + timedelta(days=i*7)
                    end_week = start_week + timedelta(days=6)
                    if start_week.month == end_week.month:
                        label = f"{start_week.day} - {end_week.day} {format_month(end_week)}"
                    else:
                        label = f"{start_week.day} {format_month(start_week)} - {end_week.day} {format_month(end_week)}"
                data.append({'label': label, 'type': 'past' if i < 0 else 'future'})
            data.append({'label': _('Not Due'), 'type': 'future'})

            is_sample_data = not journal_data
            if not is_sample_data:
                data[0]['value'] = sign * journal_data['total_before']
                data[1]['value'] = sign * journal_data['total_week1']
                data[2]['value'] = sign * journal_data['total_week2']
                data[3]['value'] = sign * journal_data['total_week3']
                data[4]['value'] = sign * journal_data['total_week4']
                data[5]['value'] = sign * journal_data['total_after']
            else:
                for index in range(6):
                    data[index]['type'] = 'o_sample_data'
                    # we use unrealistic values for the sample data
                    data[index]['value'] = random.randint(0, 20)
                    graph_key = _('Sample data')

            result[journal.id] = [{'values': data, 'title': graph_title, 'key': graph_key, 'is_sample_data': is_sample_data}]
        return result

    def get_journal_dashboard_datas(self):
        return self._get_journal_dashboard_data_batched()[self.id]

    def _get_journal_dashboard_data_batched(self):
        self.env['account.move'].flush_model()
        self.env['account.move.line'].flush_model()
        dashboard_data = {}  # container that will be filled by functions below
        for journal in self:
            dashboard_data[journal.id] = {
                'currency_id': journal.currency_id.id or journal.company_id.currency_id.id,
                'company_count': len(self.env.companies),
            }
        self._fill_bank_cash_dashboard_data(dashboard_data)
        self._fill_sale_purchase_dashboard_data(dashboard_data)
        self._fill_general_dashboard_data(dashboard_data)
        return dashboard_data

    def _fill_bank_cash_dashboard_data(self, dashboard_data):
        """Populate all bank and cash journal's data dict with relevant information for the kanban card."""
        bank_cash_journals = self.filtered(lambda journal: journal.type in ('bank', 'cash'))
        if not bank_cash_journals:
            return
        bank_account_balances = bank_cash_journals._get_journal_bank_account_balance_batched(
            domain=[('parent_state', '=', 'posted')],
        )
        outstanding_pay_account_balances = bank_cash_journals._get_journal_outstanding_payments_account_balance_batched(
            domain=[('parent_state', '=', 'posted')],
        )
        to_check = {
            res['journal_id'][0]: (res['amount'], res['journal_id_count'])
            for res in self.env['account.bank.statement.line'].read_group(
                domain=[
                    ('journal_id', 'in', bank_cash_journals.ids),
                    ('move_id.to_check', '=', True),
                    ('move_id.state', '=', 'posted'),
                ],
                fields=['amount'],
                groupby=['journal_id'],
            )
        }
        graph_datas = bank_cash_journals._get_line_graph_data_batched()

        last_statements = bank_cash_journals._get_last_bank_statement_batched(
            domain=[('move_id.state', '=', 'posted')],
        )

        for journal in bank_cash_journals:
            journal_data = journal.kanban_dashboard_binary
            last_statement = last_statements[journal.id]
            graph_data = graph_datas[journal.id]

            currency = journal.currency_id or journal.company_id.currency_id
            bank_account_balance, nb_lines_bank_account_balance = bank_account_balances[journal.default_account_id.id]
            outstanding_pay_account_balance, nb_lines_outstanding_pay_account_balance = outstanding_pay_account_balances[journal.id]
            to_check_balance, number_to_check = to_check.get(journal.id, (0, 0))

            dashboard_data[journal.id].update({
                'number_to_check': number_to_check,
                'to_check_balance': to_check_balance,
                'number_to_reconcile': journal_data.get('number_to_reconcile', 0),
                'account_balance': currency.format(bank_account_balance),
                'has_at_least_one_statement': bool(last_statement),
                'nb_lines_bank_account_balance': nb_lines_bank_account_balance,
                'outstanding_pay_account_balance': currency.format(outstanding_pay_account_balance),
                'nb_lines_outstanding_pay_account_balance': nb_lines_outstanding_pay_account_balance,
                'last_balance': currency.format(last_statement.balance_end),
                'bank_statements_source': journal.bank_statements_source,
                'graph_data': graph_data,
                'is_sample_data': graph_data and any(data.get('is_sample_data', False) for data in graph_data),
            })

    def _fill_sale_purchase_dashboard_data(self, dashboard_data):
        """Populate all sale and purchase journal's data dict with relevant information for the kanban card."""
        sale_purchase_journals = self.filtered(lambda journal: journal.type in ('sale', 'purchase'))

        graph_datas = sale_purchase_journals._get_bar_graph_datas_batched()
        for journal in sale_purchase_journals:
            journal_data = journal.kanban_dashboard_binary
            currency = journal.currency_id or journal.company_id.currency_id
            graph_data = graph_datas[journal.id]
            dashboard_data[journal.id].update({
                'number_to_check': journal_data.get('number_to_check', 0),
                'to_check_balance': journal_data.get('to_check_balance', 0),
                'title': _('Bills to pay') if journal.type == 'purchase' else _('Invoices owed to you'),
                'number_draft': journal_data.get('number_draft', 0),
                'number_waiting': journal_data.get('number_waiting', 0),
                'number_late': journal_data.get('number_late', 0),
                'sum_draft': currency.format(journal_data.get('sum_draft', 0)),
                'sum_waiting': currency.format(journal_data.get('sum_waiting', 0)),
                'sum_late': currency.format(journal_data.get('sum_late', 0)),
                'has_sequence_holes': journal.has_sequence_holes,
                'entries_count': journal_data.get('entries_count', 0),
                'graph_data': graph_data,
                'is_sample_data': graph_data and any(data.get('is_sample_data', False) for data in graph_data),
            })

    def _fill_general_dashboard_data(self, dashboard_data):
        """Populate all miscelaneous journal's data dict with relevant information for the kanban card."""
        general_journals = self.filtered(lambda journal: journal.type == 'general')
        for journal in general_journals:
            journal_data = journal.kanban_dashboard_binary
            dashboard_data[journal.id].update({
                'number_to_check': journal_data.get('number_to_check', 0),
                'to_check_balance': journal_data.get('to_check_balance', 0),
            })

    def _get_move_action_context(self):
        ctx = self._context.copy()
        ctx['default_journal_id'] = self.id
        if self.type == 'sale':
            ctx['default_move_type'] = 'out_refund' if ctx.get('refund') else 'out_invoice'
        elif self.type == 'purchase':
            ctx['default_move_type'] = 'in_refund' if ctx.get('refund') else 'in_invoice'
        else:
            ctx['default_move_type'] = 'entry'
            ctx['view_no_maturity'] = True
        return ctx

    def action_create_new(self):
        return {
            'name': _('Create invoice/bill'),
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'account.move',
            'view_id': self.env.ref('account.view_move_form').id,
            'context': self._get_move_action_context(),
        }

    def create_cash_statement(self):
        raise UserError(_('Please install Accounting for this feature'))

    def action_create_vendor_bill(self):
        """ This function is called by the "Import" button of Vendor Bills,
        visible on dashboard if no bill has been created yet.
        """
        self.env.company.sudo().set_onboarding_step_done('account_setup_bill_state')

        new_wizard = self.env['account.tour.upload.bill'].create({})
        view_id = self.env.ref('account.account_tour_upload_bill').id

        return {
            'type': 'ir.actions.act_window',
            'name': _('Import your first bill'),
            'view_mode': 'form',
            'res_model': 'account.tour.upload.bill',
            'target': 'new',
            'res_id': new_wizard.id,
            'views': [[view_id, 'form']],
        }

    def to_check_ids(self):
        self.ensure_one()
        return self.env['account.bank.statement.line'].search([
            ('journal_id', '=', self.id),
            ('move_id.to_check', '=', True),
            ('move_id.state', '=', 'posted'),
        ])

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
        """return action based on type for related journals"""
        self.ensure_one()
        action_name = self._select_action_to_open()

        # Set 'account.' prefix if missing.
        if not action_name.startswith("account."):
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

        domain_type_field = action['res_model'] == 'account.move.line' and 'move_id.move_type' or 'move_type' # The model can be either account.move or account.move.line

        # Override the domain only if the action was not explicitly specified in order to keep the
        # original action domain.
        if not self._context.get('action_name'):
            if self.type == 'sale':
                action['domain'] = [(domain_type_field, 'in', ('out_invoice', 'out_refund', 'out_receipt'))]
            elif self.type == 'purchase':
                action['domain'] = [(domain_type_field, 'in', ('in_invoice', 'in_refund', 'in_receipt', 'entry'))]

        return action

    def open_spend_money(self):
        return self.open_payments_action('outbound')

    def open_collect_money(self):
        return self.open_payments_action('inbound')

    def open_transfer_money(self):
        return self.open_payments_action('transfer')

    def open_payments_action(self, payment_type, mode='tree'):
        if payment_type == 'outbound':
            action_ref = 'account.action_account_payments_payable'
        elif payment_type == 'transfer':
            action_ref = 'account.action_account_payments_transfer'
        else:
            action_ref = 'account.action_account_payments'
        action = self.env['ir.actions.act_window']._for_xml_id(action_ref)
        action['context'] = dict(ast.literal_eval(action.get('context')), default_journal_id=self.id, search_default_journal_id=self.id)
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
            ctx['search_default_journal'] = False  # otherwise it will do a useless groupby in bank statements
        ctx.pop('group_by', None)
        action = self.env['ir.actions.act_window']._for_xml_id(f"account.{action_name}")
        action['context'] = ctx
        if ctx.get('use_domain', False):
            action['domain'] = isinstance(ctx['use_domain'], list) and ctx['use_domain'] or ['|', ('journal_id', '=', self.id), ('journal_id', '=', False)]
            action['name'] = _(
                "%(action)s for journal %(journal)s",
                action=action["name"],
                journal=self.name,
            )
        return action

    def show_sequence_holes(self):
        has_sequence_holes = self._query_has_sequence_holes()
        return {
            'type': 'ir.actions.act_window',
            'name': _("Journal Entries"),
            'res_model': 'account.move',
            'view_mode': 'list,form',
            'domain': expression.OR(
                [('journal_id', '=', journal_id), ('sequence_prefix', '=', prefix)]
                for journal_id, prefix in has_sequence_holes
            ),
            'context': {
                **self._get_move_action_context(),
                'search_default_group_by_sequence_prefix': 1,
                'expand': 1,
            }
        }

    def create_bank_statement(self):
        """return action to create a bank statements. This button should be called only on journals with type =='bank'"""
        action = self.env["ir.actions.actions"]._for_xml_id("account.action_bank_statement_tree")
        action.update({
            'views': [[False, 'form']],
            'context': "{'default_journal_id': " + str(self.id) + "}",
        })
        return action

    def create_customer_payment(self):
        """return action to create a customer payment"""
        return self.open_payments_action('inbound', mode='form')

    def create_supplier_payment(self):
        """return action to create a supplier payment"""
        return self.open_payments_action('outbound', mode='form')

    def create_internal_transfer(self):
        """return action to create a internal transfer"""
        return self.open_payments_action('transfer', mode='form')

    #####################
    # Setup Steps Stuff #
    #####################
    def mark_bank_setup_as_done_action(self):
        """ Marks the 'bank setup' step as done in the setup bar and in the company."""
        self.company_id.sudo().set_onboarding_step_done('account_setup_bank_data_state')

    def unmark_bank_setup_as_done_action(self):
        """ Marks the 'bank setup' step as not done in the setup bar and in the company."""
        self.company_id.account_setup_bank_data_state = 'not_done'
