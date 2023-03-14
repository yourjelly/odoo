# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Indian - Payment Tax',
    'icon': '/l10n_in/static/description/icon.png',
    'version': '1.0',
    'description': """Tax on payment""",
    'category': 'Accounting/Localizations',
    'depends': ['l10n_in'],
    'data': [
        'data/account.account.template.csv',
        'views/account_payment_views.xml',
        'views/account_move_views.xml',
        'views/res_config_settings_views.xml',
    ],
    'post_init_hook': '_generate_account_post_init',
    'auto_install': True,
    'license': 'LGPL-3',
}
