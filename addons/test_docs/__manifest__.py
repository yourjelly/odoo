# -*- coding: utf-8 -*-

{
    'name': 'Doc Tests',
    'version': '1.0',
    'category': 'Hidden',
    'sequence': 9876,
    'summary': 'Mail Tests: performances and tests specific to mail',
    'description': """This module contains tests related to mail. Those are
present in a separate module as it contains models used only to perform
tests independently to functional aspects of other models. """,
    'depends': [
        'mail',
    ],
    'data': [
        'security/ir.model.access.csv',
        'security/ir_rule_data.xml',
        'views/document_document_views.xml',
        'views/container_container_views.xml',
        'views/test_docs_menus.xml',
        'views/portal.xml',
    ],
    'demo': [
        'demo/document_demo.xml',
        'demo/container_demo.xml',
    ],
    'assets': {
        'test_docs.webclient': [
            ('include', 'web.assets_backend'),
            # docs webclient overrides
            'test_docs/static/src/docs_webclient/**/*',
            'web/static/src/start.js',
        ],
    },
    'installable': True,
    'license': 'LGPL-3',
}
