{
    'name': 'Passkeys',
    'version': '1.0',
    'summary': 'Passkeys',
    'description': "The implementation of 2FA through passkeys using the webauthn protocol.",
    'category': 'Hidden/Tools',
    'depends': ['base_setup', 'web', 'auth_signup'],
    'data': [
        'views/auth_passkey_key_views.xml',
        'views/auth_signup_login_templates.xml',
        'views/res_users_views.xml',
        'views/res_config_settings_views.xml',
        'views/res_users_identitycheck_views.xml',
        'security/ir.model.access.csv',
        'security/security.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'auth_passkey/static/**/*',
        ],
        'web.assets_frontend_minimal': [
            'auth_passkey/static/lib/simplewebauthn.js',
            'auth_passkey/static/src/login_passkeys.js',
        ],
    },
    'license': 'LGPL-3',
    'application': True,
}
