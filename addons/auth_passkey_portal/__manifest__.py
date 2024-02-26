{
    'name': "Passkeys",
    'category': 'Hidden',
    'depends': ['web', 'portal', 'auth_passkey'],
    'auto_install': True,
    'data': [
        'views/templates.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'auth_passkey_portal/static/src/**/*',
        ],
        'web.assets_tests': [
        ],
    },
    'license': 'LGPL-3',
}
