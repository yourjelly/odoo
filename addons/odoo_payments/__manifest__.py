# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Odoo Payments",
    'version': '1.0',
    'license': 'LGPL-3',
    'category': '',
    'summary': "Base Module for Odoo Payments",
    'description': "Base Module for Odoo Payments, used in eCommerce and PoS",
    'depends': [
        'base_address_extended',  # Advanced address formatting (to specify home number separately)
        'base_vat',  # VAT validation
        'mail',
        'phone_validation',  # Phone numbers validation
        'web',
    ],
    'data': [
        'data/odoo_payments_data.xml',

        'security/ir.model.access.csv',
        'security/ir_rule.xml',

        'views/adyen_account_templates.xml',
        'views/adyen_account_views.xml',
        'views/adyen_bank_account_views.xml',
        'views/adyen_shareholder_views.xml',
        'views/adyen_transaction_payout_views.xml',
        'views/adyen_transaction_views.xml',
        'views/odoo_payments_menus.xml',
    ],
    'external_dependencies': {
        'python': ['phonenumbers'],  # Make sure phone_validation module tools work as expected
    },
    'assets': {
        'web.assets_backend': [
            'odoo_payments/static/src/scss/**/*',
            'odoo_payments/static/src/js/**/*',
        ],
        'web.assets_qweb': [
            'odoo_payments/static/src/xml/**/*',
        ],
    },
    'application': True,
}
