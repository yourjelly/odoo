# -*- coding: utf-8 -*-
{
    'name': "Egyptian E-Invoice Integration",
    'summary': """
            Egyptian Tax Authority Invoice Integration
        """,
    'description': """
       This module integrate with the ETA Portal to automatically sign and send your invoices to the tax Authority.
    """,
    'author': 'odoo',
    'website': 'https://www.odoo.com',

    'contributors': [
        'Mario Roshdy <marioroshdyn@gmail.com>',
        'Karim Jaber <kareem@plementus.com>'
    ],
    'category': 'account',
    'version': '0.1',
    'license': 'LGPL-3',
    'depends': ['account_edi', 'l10n_eg'],
    'data': [
        'data/eta_endpoints.xml',
        'data/account_edi_data.xml',
        'data/l10n_eg_edi.activity.type.csv',
        'data/l10n_eg_edi.uom.code.csv',
        'data/uom_data.xml',

        'security/ir.model.access.csv',

        'views/product_template_view.xml',
        'views/res_company_view.xml',
        'views/res_partner_view.xml',
        'views/uom_uom_view.xml',
        'views/account_move_view.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'l10n_eg_edi_eta/static/src/js/sign_invoice.js',
        ],
    }
}
