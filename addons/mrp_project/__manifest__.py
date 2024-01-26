# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Manufacturing Project Integration',
    'version': '1.0',
    'category': 'Manufacturing/Manufacturing',
    'summary': 'Manufacturing Project Integration',
    'description': """
Technical module.
    """,
    'depends': ['mrp_account', 'project'],
    'data': [
        'report/mrp_report_bom_structure.xml',
        'security/ir.model.access.csv',
        'views/mrp_bom_views.xml',
        'views/mrp_production_views.xml',
        'views/project_task_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'mrp_project/static/src/**/*',
        ],
    },
    'installable': True,
    'auto_install': True,
    'license': 'LGPL-3',
}
