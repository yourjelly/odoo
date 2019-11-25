# -*- coding: utf-8 -*-
{
    'name': "Indian - GST Accounting",
    'category': 'Accounting/Accounting',
    'version': '1.0',

    # any module necessary for this one to work correctly
    'depends': ['base_vat', 'l10n_in'],

    # always loaded
    'data': [
        'views/account_invoice_views.xml',
        'views/account_journal_views.xml',
        'views/res_partner_views.xml',
    ],
    'installable': True,
    'auto_install': True,
}
