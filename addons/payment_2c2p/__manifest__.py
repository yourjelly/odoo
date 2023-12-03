# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Payment Provider: 2C2P',
    'version': '1.0',
    'category': 'Accounting/Payment Providers',
    'summary': "A payment provider for Asia",
    'depends': ['payment'],
    'data': [
        "data/payment_provider_data.xml",
        "views/payment_provider_views.xml",
    ],
    'license': 'LGPL-3',
    'assets': {
        'web.assets_frontend': [
            'payment_2c2p/static/src/js/payment_form.js',
        ],
    },
    'post_init_hook': 'post_init_hook',
    'uninstall_hook': 'uninstall_hook',
}
