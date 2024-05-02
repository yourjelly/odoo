# -*- coding: utf-8 -*-

{
    'name': "Stock custom",
    'summary': "",
    'description': """
        This module adds various report options and its customizations.
    """,
    'category': 'Inventory/Inventory',
    'version': '1.0',
    'depends': ['stock_barcode'],
    'installable': True,
    'license': 'OEEL-1',
    'data': [
        'report/product_template_templates.xml',
        'report/lot_serial_report.xml',
        'report/location_report.xml',
        'report/stock_report_views.xml',
    ],
    'odoo_task_id': '3898183',
}