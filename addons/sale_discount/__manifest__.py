# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Multiple Discounts',
    'version': '16.0.1.0',
    'description': """
This module adds multiple discount options in a sale order.
===========================================================================

This multiple discounts are also shown in invoice print.

    """,
    'depends': ['product', 'sale_management','account_accountant','base_automation'],
    'data': [
        'data/product_pricelist_item_fields.xml',
        'data/sale_order_line_fields.xml',
        'data/account_move_line_fields.xml',
        'views/product_pricelist_views.xml',
        'views/sale_order_line_views.xml',
        'views/account_move_line_views.xml',
        'views/ir_actions_report_templates.xml',
        'views/report_invoice.xml',
    ],
    'installable': True,
    'license': 'LGPL-3',
}
