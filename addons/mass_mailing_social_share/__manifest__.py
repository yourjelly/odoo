{
    'name': 'Social Share Marketing',
    'version': '1.0',
    'depends': [
        'mass_mailing',
        'social_share',
    ],
    'assets': {
        'mass_mailing.assets_wysiwyg': [
            'mass_mailing_social_share/static/src/snippets/s_social_share/options.js',
        ],
    },
    'data': [
        'views/snippets.xml',
        'views/snippets/s_social_share.xml',
    ],
    'auto-install': True,
    'application': True,
    'license': 'LGPL-3',
}
