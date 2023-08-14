# -*- coding: utf-8 -*-

{
    "name": "Zambia - Accounting",
    "countries": ["zm"],
    "version": "1.0.0",
    "category": "Accounting/Localizations/Account Charts",
    "license": "LGPL-3",
    "description": """
This is the basic Zambian localization necessary to run Odoo in ZM:
================================================================================
    - Chart of accounts
    - Taxes
    - Fiscal positions
    - Default settings
    - Financial (balance sheet & profit and loss) and Tax reports
    """,
    "depends": [
        "account",
    ],
    "data": [
        "data/account_tax_report_data.xml",
        "views/report_invoice.xml",
    ],
    "demo": [
        "demo/demo_company.xml",
    ]
}
