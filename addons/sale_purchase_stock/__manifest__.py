# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Sale Purchase Stock',
    'description': """
This module provides facility to the user to install purchase and sales modules at a time.
==========================================================================================

It is basically used when we want to keep track of purchase orders generated
from sales order. It adds a stat button to find generate purchase order in sale
and adds sales Reference on purchase order.
    """,
    'version': '1.0',
    'website': 'https://www.odoo.com/',
    'category': 'Hidden',
    'depends': [
        'sale_purchase',
        'sale_stock',
    ],
    'data': [
        'views/sale_order_views.xml',
    ],
    'auto_install': True,
}
