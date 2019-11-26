# -*- coding: utf-8 -*-
{
    'name': "Indian - sale (GST)",
    'category': 'Accounting/Accounting',
    'version': '1.0',

    # any module necessary for this one to work correctly
    'depends': ['sale', 'l10n_in_sale'],

    # always loaded
    'data': [
        'views/sale_order_views.xml'
    ],
    'installable': True,
    'auto_install': True,
}
