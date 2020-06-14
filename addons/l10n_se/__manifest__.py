# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    "name": "Swedish - Accounting",
    "version": "1.0",
    "category": "Accounting/Localizations/Account Charts",
    "summary": """Swedish chart of account EU BAS2020""",
    "description": """
This is the module to manage the accounting chart for Sweden in Odoo.
==============================================================================

Install some swedish chart of accounts.
    - Merge with XCLUDE CoA
    - Upgraded to EU BAS 2020 for Aktiebolag K2

    """,
    "author": "XCLUDE, Linserv AB",
    "website": "https://www.linserv.se",
    "depends": ["account", "base_vat"],
    "data": [
        "data/account_chart_template.xml",
        "data/account.account.template.csv",
        "data/account_chart_template_post_data.xml",
        "data/account_tax_group.xml",
        "data/account_tax_report_data.xml",
        "data/account_tax_template.xml",
        "data/account_fiscal_position_template.xml",
        "data/account_fiscal_position_account_template.xml",
        "data/account_fiscal_position_tax_template.xml",
        "data/account_chart_template_configuration.xml",
        "views/partner_view.xml",
        "views/account_journal_view.xml",
    ],
    'demo': [
        'demo/demo_company.xml',
        "data/menuitem_data.xml",
    ],
    "installable": True,
}
