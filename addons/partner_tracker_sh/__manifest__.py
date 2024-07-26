# -*- coding: utf-8 -*-
{
    'name': "partner_tracker",

    'description': "Track The Partner",

    'depends': ['base_partner_tracker', 'web_map'],

    'data': [
        'security/ir.model.access.csv',
        'views/partner_track_channel_view.xml',
        'views/partner_track_detail_view.xml',
        'views/partner_track_menu.xml',
    ],

    'assets': {
        'web.assets_backend': [
            'partner_tracker/static/src/**/*',
        ],
    },

    "installable": True,
    "application": True,
    "license": "LGPL-3",
}
