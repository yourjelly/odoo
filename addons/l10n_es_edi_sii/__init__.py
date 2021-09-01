# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from . import models
from odoo import api, SUPERUSER_ID


def _setup_tax_type(env):
    companies = env['res.company'].search([('partner_id.country_id.code', '=', 'ES')])
    chart_templates = companies.chart_template_id
    current_chart_templates = chart_templates
    while current_chart_templates.parent_id:
        chart_templates |= current_chart_templates.parent_id
        current_chart_templates = current_chart_templates.parent_id

    if chart_templates:
        tax_templates = env['account.tax.template'].search([
            ('chart_template_id', 'in', chart_templates.ids),
            '|', '|',
            ('l10n_es_type', '!=', False),
            ('l10n_es_exempt_reason', '!=', False),
            ('tax_scope', '!=', False),
        ])
        xml_ids = tax_templates.get_external_id()
        for company in companies:
            for tax_template in tax_templates:
                module, xml_id = xml_ids.get(tax_template.id).split('.')
                tax = env.ref('%s.%s_%s' % (module, company.id, xml_id), raise_if_not_found=False)
                if tax:
                    tax.write({
                        'l10n_es_exempt_reason': tax_template.l10n_es_exempt_reason,
                        'tax_scope': tax_template.tax_scope,
                        'l10n_es_type': tax_template.l10n_es_type,
                    })


def _l10n_es_edi_post_init(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    _setup_tax_type(env)
