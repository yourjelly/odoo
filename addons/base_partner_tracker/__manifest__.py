# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'Partner Tracker',
    'version': '1.0',
    'category': 'Services',
    'description': """
        This module is to track partners.
    """,
    'depends': ['mail','web_studio'],
    'data': [
        'models/base_partner_tracker.xml',
        'views/base_partner_tracker_views.xml',
        # 'data/mail_channel_data.xml'
    ],
    'assets': {
        'web.assets_backend': [
            'base_partner_tracker/static/src/**/*',
            'base_partner_tracker/static/lib/**/*',
        ],
    },
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}
