# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Payment Provider: Careem Pay',
    'version': '2.0',
    'category': 'Accounting/Payment Providers',
    'sequence': 350,
    'summary': "A payment provider for the Middle East region, mainly UAE, Saudi Arabia, Egypt, Pakistan, Morocco, "
               "Jordan, Lebanon.",
    'depends': ['payment'],
    'data': [
        'views/payment_careem_templates.xml',
        'views/payment_provider_views.xml',
        'views/payment_templates.xml',

        'data/payment_provider_data.xml',
    ],
    'application': False,
    'post_init_hook': 'post_init_hook',
    'uninstall_hook': 'uninstall_hook',
    'assets': {
        'web.assets_frontend': [
            'payment_careem/static/src/css/payment_careem.css',
            'payment_careem/static/src/js/express_checkout_form.js',
        ],
    },
    'license': 'LGPL-3',
}
