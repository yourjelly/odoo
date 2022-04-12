# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name' : 'Guinea - Accounting',
    'author': 'Odoo S.A.',
    'category': 'Accounting/Localizations/Taxes',
    'description': """
This module implements the tax for Guinea.
===========================================================

The Chart of Accounts is from SYSCOHADA.

    """,
    'depends' : [
        'l10n_syscohada',
    ],
    'data': [
        'data/account_tax_group_data.xml',
        'data/account_tax_template_data.xml',
        'data/account_fiscal_position_template_data.xml',
    ],
    'demo': [
        'demo/demo_company.xml',
    ],
    'license': 'LGPL-3',
}
