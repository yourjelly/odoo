# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import models
from . import demo

from odoo import api, SUPERUSER_ID


def post_init(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    # Apply default configuration on all Hungarian companies
    env["res.company"].search([("account_fiscal_country_id.code", "=", "HU")])._l10n_hu_edi_configure_company()

    # Set Hungarian fields on taxes
    set_fields_on_taxes(env)

def set_fields_on_taxes(env):
    chart_template = env.ref('l10n_hu.hungarian_chart_template', raise_if_not_found=False)
    if chart_template:
        companies = env['res.company'].search([('chart_template_id', '=', chart_template.id)])
        tax_templates = env['account.tax.template'].search([('chart_template_id', '=', chart_template.id)])
        xml_ids = tax_templates.get_external_id()

        for company in companies:
            for tax_template in tax_templates:
                module, xml_id = xml_ids.get(tax_template.id).split('.')
                tax = env.ref('%s.%s_%s' % (module, company.id, xml_id), raise_if_not_found=False)
                if tax:
                    tax.l10n_hu_tax_type = tax_template.l10n_hu_tax_type
                    tax.l10n_hu_tax_reason = tax_template.l10n_hu_tax_reason
