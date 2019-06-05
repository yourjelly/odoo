{
    'name': 'Time-based One-Time-Password support: profile hook',
    'depends': ['auth_totp', 'hr'],
    'category': 'Extra Tools',
    'auto_install': True,
    'data': [
        'views/user_profile.xml',
    ],
}
