# -*- coding: utf-8 -*-
from . import models, wizard
from odoo import api, SUPERUSER_ID


def _l10n_sa_edi_post_init(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    companies = env['res.company'].search([('partner_id.country_id.code', '=', 'SA')])

    all_chart_templates = companies.chart_template_id
    current_chart_template = all_chart_templates
    while current_chart_template.parent_id:
        all_chart_templates |= current_chart_template.parent_id
        current_chart_template = current_chart_template.parent_id

    if all_chart_templates:
        tax_templates = env['account.tax.template'].search([
            ('chart_template_id', 'in', all_chart_templates.ids)
        ])
        xml_ids = tax_templates.get_external_id()
        for company in companies:
            for tax_template in tax_templates:
                module, xml_id = xml_ids.get(tax_template.id).split('.')
                tax = env.ref('%s.%s_%s' % (module, company.id, xml_id), raise_if_not_found=False)
                if tax:
                    tax.write({
                        'l10n_sa_is_retention': False if tax.amount >= 0 else tax_template.l10n_sa_is_retention,
                    })
