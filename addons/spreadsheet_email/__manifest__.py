# -*- coding: utf-8 -*-
{
    'name': "spreadsheet_email",
    'summary': """
        Short (1 phrase/line) summary of the module's purpose, used as
        subtitle on modules listing or apps.openerp.com""",
    'description': """
        Long description of module's purpose
    """,
    'author': "My Company",
    'website': "http://www.yourcompany.com",
    'category': 'Uncategorized',
    'version': '0.1',

    'depends': ['base', 'documents_spreadsheet'],
    'assets': {
        'web.assets_backend': [
            'spreadsheet_email/static/src/js/*.js',
        ],
    }
}
