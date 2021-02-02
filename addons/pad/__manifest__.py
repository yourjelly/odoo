# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Collaborative Pads',
    'version': '2.0',
    'category': 'Hidden/Tools',
    'description': """
Adds enhanced support for (Ether)Pad attachments in the web client.
===================================================================

Lets the company customize which Pad installation should be used to link to new
pads (by default, http://etherpad.com/).
    """,
    'depends': ['web', 'base_setup'],
    'data': [
        
        'views/res_config_settings_views.xml',
    ],
    'demo': ['data/pad_demo.xml'],
    'web': True,
    'qweb': ['static/src/xml/pad.xml']
    'assets': {
        'assets_backend': [
            # inside .
            'pad/static/src/css/etherpad.css',
            # inside .
            'pad/static/src/js/pad.js',
        ],
        'qunit_suite': [
            # after //script[last()]
            'pad/static/tests/pad_tests.js',
        ],
    }
}
