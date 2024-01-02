# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': "Kenya ETIMS EDI Integration",
    'countries': ['ke'],
    'summary': """
            Kenya Tremol Device EDI Integration
        """,
    'description': """
       This module integrates with the Kenyan OSCU ETIMS device.
    """,
    'author': 'Odoo',
    'category': 'Accounting/Localizations/EDI',
    'version': '1.0',
    'license': 'LGPL-3',
    'depends': ['l10n_ke', 'product_unspsc', 'mrp'],
    'data': [
        'data/packaging_unit_codes.xml',
        'data/quantity_unit_codes.xml',
        'data/tax_codes.xml',
        'data/ir_cron_data.xml',
        'views/account_tax_views.xml',
        'views/product_views.xml',
        'views/account_move_views.xml',
        'views/stock_move_views.xml',
        'views/report_invoice.xml',
        'views/res_company_views.xml',
        'views/res_partner_views.xml',
        'views/mrp_bom_views.xml',
        'views/l10n_ke_edi_customs_import_views.xml',
        'security/ir.model.access.csv',
        'wizard/account_move_send_views.xml',
    ],
    'demo': [
        'demo/demo_company.xml',
        'demo/demo_branch.xml',
        'demo/demo_product.xml',
    ],
    #     'views/res_config_settings_view.xml',
    # ],
    # 'assets': {
    #     'web.assets_backend': [
    #         'l10n_ke_edi_tremol/static/src/components/*',
    #     ],
    # },
}
