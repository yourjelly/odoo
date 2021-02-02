{
    'name': "TOTPortal",
    'category': 'Hidden',
    'depends': ['portal', 'auth_totp'],
    'auto_install': True,
    'data': [
        'security/security.xml',
        'views/templates.xml',
    ],
    'assets': {
        'auth_totp_frontend': [
            # inside .
            'auth_totp_portal/static/src/js/totp_frontend.js',
        ],
        'assets_tests': [
            # inside .
            'auth_totp_portal/static/tests/totp_portal.js',
        ],
    }
}
