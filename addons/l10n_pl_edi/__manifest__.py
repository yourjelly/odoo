# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Poland - E-invoicing',
    'icon': '/l10n_pl/static/description/icon.png',
    'version': '0.0',
    'depends': [
        'l10n_pl',
        # Although account_edi is a dependency of account_edi_proxy_client,
        # it is here because it's in the auto-install
        'account_edi',
        'account_edi_proxy_client',
    ],
    'auto_install': ['l10n_pl'],
    'description': """
E-invoice implementation
    """,
    'category': 'Accounting/Localizations/EDI',
    'website': 'http://www.odoo.com/',
    'data': [
        'data/account_edi_data.xml',
        'data/invoice_pl_template.xml',
        'data/ksef_communication_template.xml',
        ],
    'demo': [
    ],
    'license': 'LGPL-3',
}
