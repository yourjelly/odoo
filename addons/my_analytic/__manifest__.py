# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'My Analytic',
    'version': '0.1',
    'category': 'Accounting',
    'description': """
    """,
    'depends': ['base'],
    'data': [
        'views/views.xml',
        'views/menuitems.xml',
        'security/ir.model.access.csv',
    ],
    'demo': [
        'demo/tags.xml',
        'demo/lines.xml',
    ],
    'installable': True,
    'auto_install': True,
    'license': 'LGPL-3',
}
