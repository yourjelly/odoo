# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


{
    'name': 'Adds MRP cost to Product Margin Report ',
    'description': """
    Adds MRP cost to Product's Margin Report
""",
    'depends': ['account','mrp','product_margin'],
    'data': [
        'views/product_product_views.xml'
    ],
    'installable': True,
    'auto_install': True,
    'license': 'LGPL-3',
}
