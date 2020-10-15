# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Sale barcode",
    'version': "1.0",
    'category': "Sales/Sales",
    'summary': "Barcode Scan for Sale Management",
    'description': """
Contains advanced features for sale management
    """,
    'depends': ['sale', 'barcodes'],
    'data': [
        'views/sale_views.xml',
    ],
    'demo': [
    ],
    'installable': True,
    'application': False,
    'license': 'OEEL-1',
}
