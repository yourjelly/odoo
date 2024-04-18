# -*- coding: utf-8 -*-

{
    'name': "Sale Order custom",
    'summary': "",
    'description': """
        This module adds various sales order customization.
    """,
    'category': 'Sales/Sales',
    'version': '1.0',
    'depends': ['sale_management','sale_stock','base_automation','hr','l10n_in','product_expiry'],
    'installable': True,
    'license': 'OEEL-1',
    'data': [
        'data/ir_model.xml',
        'security/ir.model.access.csv',
        'data/ir_model_fields.xml',
        'data/base_automation.xml',
        'data/ir_action_server.xml',
        'views/sale_order_views.xml',
        'views/sale_order_line_views.xml',
        'views/x_regions_views.xml',
        'views/stock_move_line_views.xml',
        'views/stock_lot_views.xml',
        'views/account_move_line_views.xml',
        'views/report_invoice.xml',
    ],
    'odoo_task_id': '3822839',
}
