# -*- coding: utf-8 -*-
import logging

from odoo import models, fields
from odoo.tools import populate
from datetime import datetime, timedelta
from functools import lru_cache
from collections import defaultdict

_logger = logging.getLogger(__name__)

class AccountBankStatement(models.Model):
    _inherit = "account.bank.statement"
    _populate_sizes = {
        'small': 10,
        'medium': 100,
        'large': 1000,
    }

    _populate_dependencies = ['account.journal', 'res.company']

    def _populate_factories(self):
        @lru_cache()
        def search_journal_ids(company_id):
            return self.env['account.journal'].search([('company_id', '=', company_id), ('type', 'in', ('cash', 'bank'))]).ids

        def get_journal(random, values, **kwargs):
            return random.choice(search_journal_ids(values['company_id']))

        def get_date(random, counter, **kwargs):
            return datetime(2020, 1, 1) + timedelta(days=random.randint(-731, 731))

        company_ids = self.env['res.company'].search([('chart_template_id', '!=', False), ('id', 'in', self.env.registry.populated_models['res.company'])])
        return [
            ('company_id', populate.iterate(company_ids.ids)),
            ('journal_id', populate.compute(get_journal)),
            ('name', populate.constant('statement_{counter}')),
            ('date', populate.compute(get_date)),
        ]


class AccountBankStatementLine(models.Model):
    _inherit = "account.bank.statement.line"

    _populate_sizes = {
        'small': 100,
        'medium': 5000,
        'large': 50000,
    }

    _populate_dependencies = ['account.bank.statement', 'res.partner']

    def _populate_factories(self):
        @lru_cache()
        def search_partner_ids(company_id):
            return self.env['res.partner'].search([('company_id', '=?', company_id)]).ids

        def get_partner(random, values, **kwargs):
            company_id = self.env['account.bank.statement'].browse(values['statement_id']).company_id.id
            partner = search_partner_ids(company_id)
            return random.choices(partner + [False], [1/len(partner)] * len(partner) + [1])[0]

        def get_date(random, counter, **kwargs):
            return datetime(2020, 1, 1) + timedelta(days=random.randint(-731, 731))

        def get_amount(random, **kwargs):
            return random.uniform(-1000, 1000) or 1

        def get_currency(random, values, **kwargs):
            journal = self.env['account.bank.statement'].browse(values['statement_id']).journal_id
            currency = random.choice(self.env['res.currency'].search([('active', '=', True)]).ids)
            return currency if currency != (journal.currency_id or journal.company_id.currency_id).id else False

        self = self.with_prefetch(self.env.registry.populated_models['account.bank.statement'])
        return [
            ('statement_id', populate.randomize(self.env.registry.populated_models['account.bank.statement'])),
            ('partner_id', populate.compute(get_partner)),
            ('payment_ref', populate.constant('statement_{values[statement_id]}_{counter}')),
            ('date', populate.compute(get_date)),
            ('amount', populate.compute(get_amount)),
            ('currency_id', populate.compute(get_currency)),
        ]

    def _populate(self, size):
        records = super()._populate(size)
        _logger.info('Posting Bank Statements')
        statements = records.statement_id.filtered(lambda r: r.date < fields.Date.today()).sorted('date')
        previous = defaultdict(lambda: 0)
        for statement in statements:
            statement.balance_start = previous[statement.company_id]
            previous[statement.company_id] = statement.balance_end_real = statement.balance_start + statement.total_entry_encoding
        statements.button_post()
        return records
