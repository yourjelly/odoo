# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Dual Language Accounting',
    'version': '1.0',
    'category': 'Accounting/Accounting', #localizations?
    'summary': 'Put invoice report in multiple languages',
    'description': """
This module offers the basic functionalities to make payments by printing checks.
It must be used as a dependency for modules that provide country-specific check templates.
The check settings are located in the accounting journals configuration page.
    """,
    'depends': ['account'],
    'data': [
        'views/report_invoice.xml'
    ],
    'installable': True,
    'auto_install': False,
}
