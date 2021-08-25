# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


{
    'name': 'MRP - Human Resources',
    'version': '0.1',
    'category': 'Manufacturing/Manufacturing',
    'description': """
        This bridge module allows to manage human resources within manufacturing.
    """,
    'depends': ['mrp', 'hr'],
    'data': [
        'views/mrp_workorder_views.xml',
    ],
    'installable': True,
    'auto_install': True,
    'license': 'LGPL-3',
}
