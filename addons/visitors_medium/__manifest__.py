# -*- coding: utf-8 -*-
{
    'name': "visitors Medium",

    'summary': """
        A Graph For Survey""",

    'description': """
        Long description of module's purpose
    """,

    'category': 'Uncategorized',
    'version': '0.1',

    'depends': ['base', 'utm'],
    'data': [
        'views/views.xml',
        'views/templates.xml',
        'security/ir.model.access.csv',
    ],
    'demo': [
        'demo/demo.xml',
    ],
    'qweb': [
        "static/src/xml/visitors_medium_widget_template.xml",
    ],
}
