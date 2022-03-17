{
    'name': 'Knowledge website',
    'summary': 'Publish your articles on the web',
    'version': '0.1',
    'depends': ['knowledge', 'website'],
    'data': [
        'views/knowledge_views.xml'
    ],
    'installable': True,
    'application': False,
    'auto_install': True,
    'license': 'LGPL-3',
    'assets': {
        'web.assets_backend': [
            'knowledge_website/static/src/scss/knowledge_views.scss',
        ]
    }
}
