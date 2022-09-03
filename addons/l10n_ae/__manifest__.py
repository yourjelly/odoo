# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'U.A.E. - Accounting',
    'author': 'Tech Receptives',
    'category': 'Accounting/Localizations/Account Charts',
    'description': """
United Arab Emirates accounting chart and localization.
=======================================================
    """,
    'depends': ['base', 'account', 'sale_stock', 'purchase_stock', 'hr_contract', 'hr_recruitment'],
    'data': [
        'data/l10n_ae_data.xml',
        'data/l10n_ae_chart_data.xml',
        'data/account.account.template.csv',
        'data/account_tax_group_data.xml',
        'data/l10n_ae_chart_post_data.xml',
        'data/account_tax_report_data.xml',
        'data/account_tax_template_data.xml',
        'data/fiscal_templates_data.xml',
        'data/account_chart_template_data.xml',
        'views/report_invoice_templates.xml',
        'views/account_move.xml',
    ],
    'demo': [
        'demo/demo_company.xml',
        'demo/demo_hr.xml',
        'demo/demo_product.xml',
        'demo/demo_invoice.xml',
        'demo/demo_bills.xml',
        'demo/demo_sale.xml',
        'demo/demo_purchase.xml',
    ],
    'license': 'LGPL-3',
}
