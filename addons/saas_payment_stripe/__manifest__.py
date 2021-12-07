# -*- coding: utf-8 -*-
{
    'name': "Payment Stripe for SaaS",
    'description': """Payment Stripe for SaaS""",
    'version': '1.0',
    'depends': ['payment_stripe_connect', 'payment_stripe_connect_proxy'],
    'auto_install': True,
    'data': [
        'views/payment_views.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'saas_payment_stripe/static/src/js/payment_form.js',
        ],
    },
    'license': 'Other proprietary',
}
