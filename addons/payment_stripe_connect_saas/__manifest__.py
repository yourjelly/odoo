# -*- coding: utf-8 -*-
{
    'name': "Payment Stripe for SaaS",
    'description': """Payment Stripe for SaaS""",
    'version': '1.0',
    'depends': ['payment_stripe_connect'],
    'auto_install': False,
    'data': [
        'views/payment_views.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'payment_stripe_connect_saas/static/src/js/payment_form.js',
        ],
    },
    'license': 'Other proprietary',
}
