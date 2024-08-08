{
    'name': 'Restrict Password Login',
    'version': '1.0',
    'summary': 'Remove the ability to login with a password. Instead force the user to go use their passkey.',
    'description': """
Passkey: No Login With Password
===========================================================

Passkeys are a secure alternative to a username and a password.
When a user logs in with a Passkey, MFA will not be required.

This module will allow the administrator to restrict users' ability to login via password.
""",
    'category': 'Hidden/Tools',
    'depends': ['auth_passkey'],
    'license': 'LGPL-3',
    'installable': True,
}
