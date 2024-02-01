{
    'name': 'WebAuthn/HR Compatibility',
    'version': '1.0',
    'summary': 'Passkeys HR Compatibility',
    'description': "The compatibility layer between webauthn and hr",
    'category': 'Hidden/Tools',
    'depends': ['webauthn', 'hr'],
    'data': [
        'views/res_users_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'webauthn_hr/static/src/webauthn_key_hr.js',
        ],
    },
    'license': 'OEEL-1',
    'auto_install': True,
}
