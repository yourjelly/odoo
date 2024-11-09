# -*- coding: utf-8 -*-
{
    'name': "Austria - SIGN AT for Point of Sale",
    'description': """
This module brings the technical requirement for the new Austria regulation with Fiskaly.
Install this if you are using the Point of Sale app in Austria.
""",
    'version': '0.1',

    'depends': ['l10n_at', 'point_of_sale'],
    'installable': True,
    'auto_install': True,
    'data': [
        'security/ir.model.access.csv',
        'views/res_company_view.xml',
        'views/pos_session_view.xml',
        'views/pos_order_view.xml',
        'views/session_report_pdf_template_view.xml',
        'wizard/pos_fiskaly_details.xml'
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'l10n_at_pos/static/src/**/*',
        ],
    },
}
