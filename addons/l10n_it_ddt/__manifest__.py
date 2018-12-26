# -*- coding: utf-8 -*-
{
    'name': "l10n_it_ddt",
    'author': "My Company",
    'website': "http://www.yourcompany.com",
    'category': 'Uncategorized',
    'version': '0.1',

    'depends': ['base', 'sale_stock'],

    'data': [
        'security/l10n_it_ddt_security.xml',
        'security/ir.model.access.csv',
        'views/l10n_it_ddt_views.xml',
        'views/stock_picking.xml',
        'data/ddt_sequence_data.xml',
    ]
}
