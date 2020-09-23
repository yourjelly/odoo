

# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Wowl',
    'category': 'Hidden',
    'version': '1.0',
    'description':
        """
Odoo Web core module written in Owl.
        """,
    'depends': ['base'],
    'auto_install': True,
    'data': [
        'views/templates.xml',
    ],
    'qweb': [
        'static/src/components'
    ],
}
