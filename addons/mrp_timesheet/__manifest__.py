# -*- coding: utf-8 -*-
#  Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Manufacturing Timesheet Integration',
    'version': '1.0',
    'category': 'Manufacturing/Manufacturing',
    'summary': 'Manufacturing Timesheet Integration',
    'description': """
Technical module.
    """,
    'depends': ['mrp_project', 'hr_timesheet'],
    'data': [
        'views/manufacturing_order_views.xml',
        'views/hr_timesheet_views.xml',
    ],
    'installable': True,
    'auto_install': True,
    'license': 'LGPL-3',
}
