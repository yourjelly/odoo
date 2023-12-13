# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Poland - E-invoicing',
    'icon': '/l10n_pl/static/description/icon.png',
    'version': '0.0',
    'depends': [
        'l10n_pl',
    ],
    'auto_install': ['l10n_pl'],
    'description': """
E-invoice implementation
    """,
    'category': 'Accounting/Localizations/EDI',
    'website': 'http://www.odoo.com/',
    'data': [
        'data/invoice_pl_template.xml',
        'data/ksef_communication_template.xml',
        'views/res_config_settings_view.xml',
        'views/account_journal_dashboard_views.xml',
        'wizard/account_move_send_views.xml',
        ],
    'demo': [
    ],
    'license': 'LGPL-3',
}
