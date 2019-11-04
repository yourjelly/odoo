# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Account AI',
    'version': '1.0',
    'category': 'Accounting/Accounting',
    'description': """
Does magic. Or not.
    """,
    'depends': ['account'],
    'data': [
        'security/account_security.xml',
        'security/ir.model.access.csv',
        'views/account_ai_views.xml',
    ],
    'installable': True,
}
