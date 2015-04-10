# -*- coding: utf-8 -*-

{
    'name': 'Planner',
    'category': 'Planner',
    'summary': 'Help to configure application',
    'version': '1.0',
    'description': """Application Planner""",
    'author': 'Odoo SA',
    'depends': ['web'],
    'data': [
        'security/ir.model.access.csv',
        'views/web_planner.xml',
        'views/web_planner_view.xml',
        'security/web_planner_security.xml',
    ],
    'qweb': ['static/src/xml/web_planner.xml'],
    'installable': True,
    'auto_install': True,
}
