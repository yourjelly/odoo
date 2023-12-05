# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Payment Provider: PhonePe",
    'version': '1.0',
    'category': 'Accounting/Payment Providers',
    'sequence': 350,
    'summary': "A payment provider covering India.",
    'depends': ['payment'],
    'data': [
        'views/payment_provider.xml',
        'views/payment_phonepe_templates.xml',
        'data/payment_phonepe_data.xml',
    ],
    # 'post_init_hook': 'post_init_hook',
    # 'uninstall_hook': 'uninstall_hook',
    'license': 'LGPL-3',
}
