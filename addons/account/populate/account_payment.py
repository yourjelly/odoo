# -*- coding: utf-8 -*-

from odoo import models, fields
from odoo.tools import populate

from datetime import datetime, timedelta
import logging
import random
import math
from functools import lru_cache

_logger = logging.getLogger(__name__)


class AccountPayment(models.Model):
    _inherit = "account.payment"

    _populate_sizes = {
        'small': 100,
        'medium': 5000,
        'large': 50000,
    }

    _populate_dependencies = ['res.company', 'res.partner', 'account.journal']

    def _populate_factories(self):
        @lru_cache()
        def search_partner_ids(company_id):
            return self.env['res.partner'].search([('company_id', '=?', company_id)]).ids

        @lru_cache()
        def search_journal_ids(company_id):
            return self.env['account.journal'].search([('company_id', '=', company_id), ('type', 'in', ('cash', 'bank'))]).ids

        @lru_cache()
        def search_payment_method_ids(type):
            return self.env['account.payment.method'].search([('payment_type', '=', type)]).ids

        def get_partner(values, **kwargs):
            partner_type = values['partner_type']
            company_id = values['company_id']
            partner_ids = search_partner_ids(company_id)
            if partner_type == 'customer':
                return random.choice(partner_ids[:math.ceil(len(partner_ids)/5*2)])
            else:
                return random.choice(partner_ids[math.floor(len(partner_ids)/5*3):])

        def get_journal(values, **kwargs):
            return random.choice(search_journal_ids(values['company_id']))

        def get_amount(random, **kwargs):
            return random.uniform(0, 1000)

        def get_payment_method(values, **kwargs):
            return random.choice(search_payment_method_ids(values['payment_type']))

        def get_date(random, counter, **kwargs):
            return datetime(2020, 1, 1) + timedelta(days=random.randint(-731, 731))

        company_ids = self.env['res.company'].search([('chart_template_id', '!=', False), ('id', 'in', self.env.registry.populated_models['res.company'])])
        return [
            ('company_id', populate.cartesian(company_ids.ids)),
            ('payment_type', populate.cartesian(['inbound', 'outbound'])),
            ('partner_type', populate.cartesian(['customer', 'supplier'])),
            ('payment_method_id', populate.compute(get_payment_method)),
            ('partner_id', populate.compute(get_partner)),
            ('journal_id', populate.compute(get_journal)),
            ('amount', populate.compute(get_amount)),
            ('date', populate.compute(get_date)),
        ]

    def _populate(self, size):
        records = super()._populate(size)
        _logger.info('Validating Payments')
        records.move_id.filtered(lambda r: r.date < fields.Date.today()).post()
        return records
