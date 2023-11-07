# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': "Spreadsheet Stock Formulas",
    'version': '1.0',
    'category': 'Stock',
    'summary': 'Spreadsheet Stock formulas',
    'description': 'Spreadsheet Accounting formulas',
    'depends': ['spreadsheet', 'stock'],
    'data': [],
    'installable': True,
    'auto_install': True,
    'license': 'LGPL-3',
    'assets': {
        'spreadsheet.o_spreadsheet': [
            (
                'after',
                'spreadsheet/static/src/o_spreadsheet/o_spreadsheet.js',
                'spreadsheet_stock/static/src/**/*.js'
            ),
        ],
    }
}
