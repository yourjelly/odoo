{
    'name': 'Test Marketing Card',
    'version': '1.0',
    'category': 'Hidden',
    'summary': 'Test Marketing Card Functionality',
    'depends': ['marketing_card', 'mass_mailing_marketing_card'],
    'data': [
        'security/ir.model.access.csv',
    ],
    'assets': {
        'web.assets_tests': [
            'test_marketing_card/static/tests/tours/**/*',
        ],
    },
    'application': False,
    'installable': True,
    'license': 'LGPL-3',
}
