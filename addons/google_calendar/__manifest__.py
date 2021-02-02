# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Google Calendar',
    'version': '1.0',
    'category': 'Productivity',
    'description': "",
    'depends': ['google_account', 'calendar'],
    'qweb': ['static/src/xml/*.xml'],
    'data': [
        'data/google_calendar_data.xml',
        'security/ir.model.access.csv',
        'wizard/reset_account_views.xml',
        'views/res_config_settings_views.xml',
        'views/res_users_views.xml',
        'views/google_calendar_views.xml',
        
    ],
    'demo': [],
    'installable': True,
    'auto_install': False,
    'assets': {
        'assets_backend': [
            # inside .
            'google_calendar/static/src/js/google_calendar_popover.js',
            # inside .
            'google_calendar/static/src/js/google_calendar.js',
        ],
        'qunit_suite': [
            # inside .
            'google_calendar/static/tests/mock_server.js',
            # inside .
            'google_calendar/static/tests/google_calendar_tests.js',
        ],
        'qunit_mobile_suite': [
            # inside .
            'google_calendar/static/tests/mock_server.js',
        ],
    }
}
