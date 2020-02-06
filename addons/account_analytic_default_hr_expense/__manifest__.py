# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Account Analytic Defaults for expenses.',
    'version': '1.0',
    'category': 'Accounting/Accounting',
    'description': """
Set default values for your analytic accounts on your hr expenses.
==================================================================

Allows to automatically select analytic accounts based on Product
    """,
    'depends': ['account_analytic', 'hr_expense'],
    'auto_install': True,
}
