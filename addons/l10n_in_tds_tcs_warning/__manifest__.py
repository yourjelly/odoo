{
    'name': 'Indian - TDS, TCS Warning',
    'version': '1.0',
    'countries': ['in'],
    'description': "Indian Accounting: TDS, TCS Section warning",
    'depends': [
        'l10n_in',
        'l10n_in_withholding',
    ],
    'data': [
        'security/ir.model.access.csv',
        'data/account_tax_report_tds_data.xml',
        'views/account_account_views.xml',
        'views/account_move_views.xml',
        'views/account_tax_views.xml',
        'views/l10n_in_section_alert_views.xml',
    ],
    'post_init_hook': '_l10n_in_tds_tcs_warning_post_init_hook',
    'license': 'LGPL-3',
}
