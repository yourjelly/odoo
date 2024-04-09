import csv

from odoo.tools import file_open
from . import models


def _edit_tax_types(env, template_data):
    """
    Applies all existing tax l10n_in_section_id field to their proper value if any link between tax and their template is found
    """
    concerned_company_ids = [
        company.id for company in env.companies
        if company.chart_template and company.chart_template.startswith('in')
    ]

    if not concerned_company_ids:
        return

    current_taxes = env['account.tax'].search([
        ('company_id', 'in', concerned_company_ids)
    ])

    if not current_taxes:
        return

    xmlid2tax = {
        xml_id.split('.')[1].split('_', maxsplit=1)[1]: env['account.tax'].browse(tax)
        for tax, xml_id in current_taxes.get_external_id().items()
    }

    for xmlid, values in template_data.items():
        oldtax = xmlid2tax.get(xmlid)
        for company_id in concerned_company_ids:
            section_id = env.ref(f"account.{company_id}_{values}", raise_if_not_found=False).id
        if oldtax and section_id:
            oldtax.l10n_in_section_id = section_id


def _l10n_in_tds_tcs_warning_post_init_hook(env):
    for company in env['res.company'].search([('chart_template', '=', 'in')]):
        ChartTemplate = env['account.chart.template'].with_company(company)
        ChartTemplate._load_data({
            'l10n_in.section.alert': ChartTemplate._get_l10n_in_section_alert(),
        })
    if env['account.tax'].search_count([('country_id', '=', env.ref('base.in').id)], limit=1):
        with file_open('l10n_in_tds_tcs_warning/data/template/account.tax-in.csv') as template_file:
            template_data = {record['id']: record['l10n_in_section_id'] for record in csv.DictReader(template_file)}
        _edit_tax_types(env, template_data)
