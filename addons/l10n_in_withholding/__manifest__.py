{
    'name': 'Indian - Withholding',
    'version': '1.0',
    'description': """
        Support for Indian Withholding Tax Deduction (TDS).
    """,
    'category': 'Accounting/Localizations',
    'depends': ['l10n_in'],
    'auto_install': ['l10n_in'],
    'data': [
        'security/ir.model.access.csv',
        'wizard/l10n_in_account_withhold_wizard.xml',
        'views/account_move_views.xml',
        'views/account_payment_views.xml',
        'views/res_config_settings_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'l10n_in_withholding/static/src/template.xml',
        ],
    },
    'post_init_hook': '_l10n_in_withholding_post_init',
    'license': 'LGPL-3',
}
