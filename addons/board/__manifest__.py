# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Dashboards',
    'version': '1.0',
    'category': 'Productivity',
    'sequence': 225,
    'summary': 'Build your own dashboards',
    'description': """
Lets the user create a custom dashboard.
========================================

Allows users to create custom dashboard.
    """,
    'depends': ['base', 'web'],
    'data': [
        'security/ir.model.access.csv',
        'views/board_views.xml',
        
    ],
    'qweb': ['static/src/xml/board.xml'],
    'application': True,
    'assets': {
        'assets_backend': [
            # inside .
            'board/static/src/scss/dashboard.scss',
            # inside .
            'board/static/src/js/action_manager_board_action.js',
            # inside .
            'board/static/src/js/board_view.js',
            # inside .
            'board/static/src/js/add_to_board_menu.js',
        ],
        'qunit_suite': [
            # inside .
            'board/static/tests/dashboard_tests.js',
        ],
    }
}
