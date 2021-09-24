# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Odoo Payments Payment Acquirer',
    'version': '2.0',
    'category': 'Accounting/Payment Acquirers',
    'sequence': 330,
    'summary': 'Payment Acquirer: Odoo Payments',
    'description': """Odoo Payments""",
    'depends': ['payment', 'odoo_payments'],
    'data': [
        'views/adyen_transaction_views.xml',
        'views/payment_acquirer_views.xml',
        'views/payment_odoo_templates.xml',

        # Needs redirect form from templates
        'data/payment_acquirer_data.xml',
    ],
    'application': True,
    'uninstall_hook': 'uninstall_hook',
    'license': 'LGPL-3',
}
