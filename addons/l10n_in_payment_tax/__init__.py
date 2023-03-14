# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import models
from odoo import api, SUPERUSER_ID
from odoo.exceptions import ValidationError
from psycopg2 import IntegrityError

import logging

_logger = logging.getLogger(__name__)

def _generate_account_post_init(cr, registry):
    """Generate account that added from this module"""
    env = api.Environment(cr, SUPERUSER_ID, {})
    in_chart_template = env.ref('l10n_in.indian_chart_template_standard')
    account_template = env.ref('l10n_in_payment_tax.p10059')
    code_digits = in_chart_template.code_digits
    for company in env['res.company'].search([('chart_template_id', '=', in_chart_template.id)]):
        company.account_advance_payment_tax_adjustment_journal_id = env['account.journal'].search([('type','=','general')], limit=1)
        code_main = account_template.code and len(account_template.code) or 0
        code_acc = account_template.code or ''
        if code_main > 0 and code_main <= code_digits:
            code_acc = str(code_acc) + (str('0'*(code_digits-code_main)))
        vals = in_chart_template._get_account_vals(company, account_template, code_acc, {})
        template_vals = [(account_template, vals)]
        try:
            with env.cr.savepoint():
                new_account = in_chart_template._create_records_with_xmlid('account.account', template_vals, company)
                company.account_advance_payment_tax_account_id = new_account.id
            env.cr.commit()
        except Exception as e:
            _logger.error("Can't load Advance Payment account for company: %s(%s).", company.name, company.id)