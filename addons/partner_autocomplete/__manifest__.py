# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


{
    'name': "Partner Autocomplete",
    'summary': "Auto-complete partner companies' data",
    'version': '1.1',
    'description': """
       Auto-complete partner companies' data
    """,
    'author': "Odoo SA",
    'category': 'Hidden/Tools',
    'version': '1.0',
    'depends': [
        'iap_mail',
    ],
    'data': [
        'security/ir.model.access.csv',
        
        'views/res_partner_views.xml',
        'views/res_company_views.xml',
        'views/res_config_settings_views.xml',
        'data/cron.xml',
    ],
    'qweb': [
        'static/src/xml/partner_autocomplete.xml',
    ],
    'auto_install': True,
    'assets': {
        'assets_backend': [
            # inside .
            'partner_autocomplete/static/src/scss/partner_autocomplete.scss',
            # inside .
            'partner_autocomplete/static/src/js/partner_autocomplete_core.js',
            # inside .
            'partner_autocomplete/static/src/js/partner_autocomplete_fieldchar.js',
            # inside .
            'partner_autocomplete/static/src/js/partner_autocomplete_many2one.js',
        ],
        'tests_assets': [
            # after //script[last()]
            'partner_autocomplete/static/lib/jsvat.js',
        ],
        'qunit_suite': [
            # after //script[last()]
            'partner_autocomplete/static/tests/partner_autocomplete_tests.js',
        ],
    }
}
