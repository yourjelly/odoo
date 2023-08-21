# -*- coding: utf-8 -*-
{
    'name': "chrome_printing",
    'version': '1.0',
    'category': 'Uncategorized',
    'license': 'LGPL-3',
    'summary': """
        Allows to print reports using Google Chrome instead of wkhtmltopdf
        """,
    'depends': ['base', 'web'],
    'installable': True,
    'data': [
        'views/templates.xml',
    ],
    'external_dependencies': {
        'python': ['websocket-client'],
    },
}
