# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


{
    "name": "Withholding Tax",
    "version": "1.0",
    'category': 'Accounting/Localizations/Account Charts',
    "description": """
This module provides functionality to allow a tax not to be computed
by the 
""",
    "depends": [
        "account",
    ],
    "data": [
        "views/account_tax_views.xml",
        "views/account_move_views.xml",
    ],

}
