# -*- coding: utf-8 -*-
{
    'name': "Snail Mail",
    'description': """
Allows users to send documents by post
=====================================================
        """,
    'category': 'Hidden/Tools',
    'version': '0.3',
    'depends': [
        'iap_mail',
        'mail'
    ],
    'data': [
        'data/snailmail_data.xml',
        'views/report_assets.xml',
        'views/snailmail_views.xml',
        
        'wizard/snailmail_confirm_views.xml',
        'wizard/snailmail_letter_cancel_views.xml',
        'wizard/snailmail_letter_format_error_views.xml',
        'wizard/snailmail_letter_missing_required_fields_views.xml',
        'security/ir.model.access.csv',
    ],
    'qweb': [
        'static/src/bugfix/bugfix.xml',
        'static/src/components/message/message.xml',
        'static/src/components/notification_group/notification_group.xml',
        'static/src/components/snailmail_error_dialog/snailmail_error_dialog.xml',
        'static/src/components/snailmail_notification_popover/snailmail_notification_popover.xml',
    ],
    'auto_install': True,
    'assets': {
        'assets_backend': [
            # inside .
            'snailmail/static/src/bugfix/bugfix.js',
            # inside .
            'snailmail/static/src/components/message/message.js',
            # inside .
            'snailmail/static/src/components/notification_group/notification_group.js',
            # inside .
            'snailmail/static/src/components/snailmail_error_dialog/snailmail_error_dialog.js',
            # inside .
            'snailmail/static/src/components/snailmail_notification_popover/snailmail_notification_popover.js',
            # inside .
            'snailmail/static/src/models/message/message.js',
            # inside .
            'snailmail/static/src/models/messaging/messaging.js',
            # inside .
            'snailmail/static/src/models/notification_group/notification_group.js',
            # inside .
            'snailmail/static/src/bugfix/bugfix.scss',
            # inside .
            'snailmail/static/src/components/snailmail_notification_popover/snailmail_notification_popover.scss',
        ],
        'tests_assets': [
            # inside .
            'snailmail/static/tests/helpers/mock_models.js',
            # inside .
            'snailmail/static/tests/helpers/mock_server.js',
        ],
        'qunit_suite': [
            # inside .
            'snailmail/static/src/bugfix/bugfix_tests.js',
            # inside .
            'snailmail/static/src/components/message/message_tests.js',
            # inside .
            'snailmail/static/src/components/notification_list/notification_list_notification_group_tests.js',
        ],
    }
}
