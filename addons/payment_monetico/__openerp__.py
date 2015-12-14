# -*- coding: utf-8 -*-

{
    'name': 'Monetico Payment Acquirer',
    'category': 'Hidden',
    'summary': 'Payment Acquirer: Monetico Implementation',
    'version': '1.0',
    'description': """Monetico Payment Acquirer""",
    'depends': ['payment'],
    'data': [
        'views/monetico.xml',
        'views/payment_acquirer.xml',
        'data/monetico.xml',
    ],
    'installable': True,
}
