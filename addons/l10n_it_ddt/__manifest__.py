# -*- coding: utf-8 -*-
{
    'name': "l10n_it_ddt",
    'author': "My Company",
    'website': "http://www.yourcompany.com",
    'category': 'Uncategorized',
    'version': '0.1',

    'depends': ['l10n_it', 'sale_stock'],

    'data': [
        'security/ir.model.access.csv',
        'data/l10n_it_ddt_sequence_data.xml',
        'report/l10n_it_ddt_report.xml',
        'wizard/picking_to_ddt.xml',
        'views/l10n_it_ddt_views.xml',
        'views/sale_views.xml',
        'views/stock_picking_views.xml',
    ]
}
