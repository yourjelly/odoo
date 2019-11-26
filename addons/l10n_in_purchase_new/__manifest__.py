# -*- coding: utf-8 -*-
{
    'name': "Indian - Purchase (GST)",
    'category': 'Accounting/Accounting',
    'version': '1.0',

    # any module necessary for this one to work correctly
    'depends': ['purchase', 'l10n_in'],

    # always loaded
    'data': [
        'views/purchase_order_views.xml'
    ],
    'installable': True,
    'auto_install': True,
}
