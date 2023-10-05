{
    'name': 'Webauthn based Two-Factor Authentication',
    'description': """
Webauthn based Two-Factor Authentication
========================================
Allows users to configure two-factor authentication on their user account
for extra security, using Webauthn.

Once enabled, the user will need to use a security key or a biometric
authentication (fingerprint, face, etc.) before being granted access to the
system.

Note: logically, two-factor prevents password-based RPC access for users
where it is enabled. In order to be able to execute RPC scripts, the user
can setup API keys to replace their main password.
    """,
    'depends': ['web'],
    'category': 'Extra Tools',
    'auto_install': True,
    'data': [
        "views/res_users_views.xml",
        "views/templates.xml",
        "security/security.xml",
    ],
    'assets': {
        "web.assets_backend": [
            "auth_webauthn/static/src/actions/**/*",
        ],
        "webauthn.assets": [
            "auth_webauthn/static/src/components/webauthn_login.js",
        ]
    },
    'license': 'LGPL-3',
}
