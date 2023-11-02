# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Stock Statement Ledger",

    'summary': """
        Stock Statement Ledger.
    """,

    'description': """
        Stock Statement Ledger Report
    """,

    'author': "Odoo India",
    'website': "https://www.odoo.com",

    # Categories can be used to filter modules in modules listing
    # Check https://github.com/odoo/odoo/blob/15.0/odoo/addons/base/data/ir_module_category_data.xml
    # for the full list
    'category': 'Customizations',
    'version': '0.1',

    # any module necessary for this one to work correctly
    'depends': ['stock', 'mrp'],

    # always loaded
    'data': [
        'security/ir.model.access.csv',
        'wizards/stock_statement_ledger.xml',
        'views/stock_location_views.xml',
    ],
    # only loaded in demonstration mode
    'demo': [
    ],
    'license': 'LGPL-3',
    'application': False,
    'installable': True,
    'auto_install': False,
}
