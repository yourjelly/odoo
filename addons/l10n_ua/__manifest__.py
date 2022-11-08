# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'Ukraine - Accounting',
    'version': '1.0',
    'category': 'Accounting/Localizations/Account Charts',
    'author': 'Odoo S.A.',
    'description': """
        Chart of accounts and Taxes for Ukraine
    """,
    'depends': [
        'account', 'base_vat', 'l10n_multilang',
    ],
    'data': [
        'data/account_chart_template.xml',
        'data/account.account.template.csv',
        'data/account_account_tag_data.xml',
        'data/account_tax_group_data.xml',
        'data/account_tax_template.xml',
        'data/account_chart_template_config.xml',
    ],
    'demo': [
        'demo/demo_company.xml',
    ],
    'post_init_hook': 'load_translations',
    'license': 'LGPL-3',
}
