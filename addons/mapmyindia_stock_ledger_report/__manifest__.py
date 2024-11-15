# -*- coding: utf-8 -*-

{
    "name": "Stock Ledger Report",
    "summary": """Stock Ledger Report""",
    "category": "",
    "version": "1.0",
    "author": "Odoo India",
    "website": "http://www.odoo.com",
    "license": "LGPL-3",
    "depends": [
        "stock_account",
    ],
    "data": [
        "security/ir.model.access.csv",
        "wizard/form_view_wizard_stock_ledger_jar.xml",
        "views/menu.xml",
    ],
    'license': 'LGPL-3',
}
