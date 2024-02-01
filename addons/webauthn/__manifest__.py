{
    'name': 'WebAuthn',
    'version': '1.0',
    'summary': 'Passkeys',
    'description': "The implementation of 2FA through passkeys using the webauthn protocol.",
    'category': 'Hidden/Tools',
    'depends': ['base_setup'],
    'data': [
        'views/res_users_views.xml',
        'views/webauthn_key_views.xml',
        'views/auth_signup_login_templates.xml',
        'security/ir.model.access.csv',
        'security/security.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'webauthn/static/**/*',
        ],
        'web.assets_frontend_minimal': [
            'webauthn/static/lib/simplewebauthn.js',
            'webauthn/static/src/login_webauthn.js',
        ],
    },
    'license': 'OEEL-1',
}
