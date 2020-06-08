# -*- coding: utf-8 -*-

{
    'name': 'Adyen (by Odoo) Payment Acquirer',
    'category': 'Accounting/Payment',
    'summary': 'Payment Acquirer: Adyen (by Odoo) Implementation',
    'version': '1.0',
    'description': """Adyen (by Odoo) Payment Acquirer""",
    'depends': ['payment', 'adyen_platforms'],
    'data': [
        'views/payment_views.xml',
        'views/payment_adyen_templates.xml',
        'data/payment_acquirer_data.xml',
    ],
    'images': ['static/description/icon.png'],
    'installable': True,
    'post_init_hook': 'create_missing_journal_for_acquirers',
    'uninstall_hook': 'uninstall_hook',
}
