{
    'name': 'Open Academy',
    'category': 'Academy',
    'website': 'https://www.odoo.com/',
    'summary': 'Manage couse and session',
    'version': '2.0',
    'description': """
OpenERP Open Academy
====================

        """,
    'depends': ['website', 'mail'],
    'data': [
        'data/open_academy_data.xml',
        'views/open_academy_views.xml',
        'views/openacademy_templates.xml',
        'views/snippet.xml'
    ],
    'installable': True,
    'auto_install': True,
}

