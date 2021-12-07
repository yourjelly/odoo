# -*- coding: utf-8 -*-
{
    'name': "Onboarding Payment Connect",
    'description': """Ease Payment Onboarding""",
    'category': 'Hidden',
    'version': '1.0',
    'depends': ['payment'],
    'auto_install': True,
    'data': [
        'data/payment_acquirer_data.xml',
        'wizard/payment_acquirer_onboarding_templates.xml',
    ],
    'license': 'LGPL-3',
}
