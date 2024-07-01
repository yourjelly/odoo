# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "GKPL Report Customization",
    'summary': "Report customizations",
    'description': """
    This module adds various report customizations in different modules
    """,

    'author': "Odoo Customization",
    'version': '17.0.1.0',
    'category': 'Customization',
    'depends': [
        'sale_management',
        'stock'
    ],
    'data': [
        'views/sale_order_line_views.xml',
        'views/account_move_line_views.xml',
        'reports/sale_report.xml',
        'reports/report_invoice.xml',
    ],
    'installable': True,
    'license': 'LGPL-3',
    'odoo_task_id': '4019682'
}
