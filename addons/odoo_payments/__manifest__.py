# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Odoo Payments",
    'version': '1.0',
    'category': '',
    'summary': 'Base Module for Odoo Payments',
    'description': 'Base Module for Odoo Payments, used in eCommerce and PoS',
    'depends': [
        # Advanced address formatting (necessary to specify home number separately)
        'base_address_extended',
        'base_vat', # VAT validation
        'mail',
        'phone_validation', # Phone numbers validation
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
        'views/adyen_transaction_views.xml',
        ],
    'installable': True,
    'assets': {
        'web.assets_backend': [
            'odoo_payments/static/src/scss/**/*',
            'odoo_payments/static/src/js/**/*',
        ],
        'web.assets_qweb': [
            'odoo_payments/static/src/xml/**/*',
        ],
    },
    'license': 'LGPL-3',
}
