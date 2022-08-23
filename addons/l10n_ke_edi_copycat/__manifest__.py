# -*- coding: utf-8 -*-
{
    'name': "Kenya Copycat EDI Integration",
    'summary': """
            Kenya Copycat EDI Integration
        """,
    'description': """
       This module integrates with the API provided by copycat on the Novitus
        device.

    """,
    'author': 'odoo',
    'website': 'https://www.odoo.com',
    'category': 'account',
    'version': '0.1',
    'license': 'LGPL-3',
    'depends': ['l10n_ke'],
    'data': [
        'views/res_company_view.xml',
        'views/account_move_view.xml',
        'views/product_view.xml',
        'views/report_invoice.xml',
    ],
    'demo': [
        'demo/demo.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'l10n_ke_edi_copycat/static/src/js/send_invoice.js',
        ],
    },
}
