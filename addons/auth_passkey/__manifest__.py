{
    'name': 'Passkeys (Authn)',
    'description': """
Passkey Authentication (WebAuthn)
=================================
Allows users to configure passkeys on their user account
for extra security, using asymmetric public key cryptography.

Once enabled, the user is able to generate a passkey which can used
to sign in. Passkeys are a safer and easier alternative to a username/password +
One Time Pin. With passkeys users are able to sign in with biometrics.

A passkey can meet multifactor authentication requirements in a single step.
It protects users against phishing, and reduces the impact of data breaches on the server.
    """,
    'depends': ['web'],
    'external_dependencies': {
        'python': ['webauthn'],
    },
    'category': 'Extra Tools',
    'auto_install': True,
    'data': [
        'security/ir.model.access.csv',
    ],
    'license': 'LGPL-3',
}
