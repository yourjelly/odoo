# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Peppol Invoice Response",
    'summary': "This module is used to send/receive invoice responses with PEPPOL",
    'description': """
    TODO
    """,
    'category': 'Accounting/Accounting',
    'version': '1.0',
    'depends': [
        'account_peppol',
    ],
    'data': [
        'security/ir.model.access.csv',
        'data/application_response_templates.xml',
        'data/mail_activity_type_data.xml',
        'views/peppol_invoice_response_views.xml',
    ],
    'license': 'LGPL-3',
    'assets': {
        'web.assets_backend': [
            'account_peppol_invoice_response/static/src/**/*',
        ],
    },
}
