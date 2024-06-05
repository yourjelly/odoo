# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Purchase Report Customizations',
    'version': 'saas~17.1.0.1.0',
    'category': 'Customization',
    'sequence': 35,
    'summary': 'Customization on Purchase Order report',
    'website': 'https://www.odoo.com/app/purchase',
    'depends': [
        'purchase',
    ],
    'data': [
        'report/purchase_reports.xml',
        'views/header_template.xml',
        'report/purchase_order_report.xml',
    ],
    'installable': True,
    'license': 'LGPL-3',
    'odoo_task_id': '3950298'
}