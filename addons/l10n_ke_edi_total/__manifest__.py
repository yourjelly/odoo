# -*- coding: utf-8 -*-
{
    'name': "Kenya TIMS Integration",
    'summary': """
            Kenya TIMS Integration
        """,
    'description': """
       This module integrate with the devices from Total Solutions. 
       
       You will need the device and an IoT Box or install the servers  
       on a local computer, which will send the invoices to the device in a second step
    """,
    'author': 'odoo',
    'website': 'https://www.odoo.com',
    'category': 'account',
    'version': '0.1',
    'license': 'LGPL-3',
    'depends': ['account_edi', 'l10n_ke'],
    'data': [
        'data/account_edi_data.xml',
        'views/account_move_view.xml',
        'views/product_template_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'l10n_ke_edi_total/static/src/js/send_invoice.js',
        ],
    },
}
