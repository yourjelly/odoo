{
    'name': 'Knowledge website',
    'summary': 'Publish your articles on the web',
    'version': '0.1',
    'depends': [
        'knowledge',
        'website'
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/knowledge_views.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': True,
    'license': 'LGPL-3',
    'assets': {}
}
