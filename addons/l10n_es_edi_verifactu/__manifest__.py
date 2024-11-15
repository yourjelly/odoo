# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'author': 'Odoo',
    'name': 'Spain - Veri*Factu EDI',
    'version': '1.0',
    'category': 'Accounting/Localizations/EDI',
    'summary': "Module for sending Spanish Veri*Factu XML to the AEAT",
    'countries': ['es'],
    'depends': ['l10n_es'],
    'data': [
        'security/ir.model.access.csv',
        'wizard/account_move_send_views.xml',
        'views/soap_templates.xml',
    ],
    'installable': True,
    'auto_install': True,
    'license': 'LGPL-3',
}
