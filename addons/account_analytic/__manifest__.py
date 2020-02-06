# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Account Analytic',
    'version': '1.0',
    'category': 'Accounting/Accounting',
    'description': """
    TODO: description
    """,
    'depends': ['account', 'analytic'],
    'data': [
        'security/ir.model.access.csv',
        'security/account_analytic_security.xml',
        'views/account_menuitem.xml',
        'views/account_analytic_view.xml',
        'report/account_invoice_report_view.xml',
        'views/account_move_views.xml',
        'views/account_view.xml',
        'views/res_config_settings_views.xml',
        'views/account_analytic_default_view.xml',
    ],
    'installable': True,
    'auto_install': True,
}
