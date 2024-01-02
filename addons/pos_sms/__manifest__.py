# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'POS-SMS',
    'category': 'Send sms to customer of order confirmation',
    'description': """This module integrates POS with SMS""",
    'depends': ['point_of_sale', 'sms'],
    'data': [
        'data/sms_data.xml',
        'views/res_config_settings_views.xml',
    ],
    'demo': [
        'data/point_of_sale_demo.xml',
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'pos_sms/static/src/js/**/*',
            'pos_sms/static/src/xml/**/*',
            ('after', 'point_of_sale/static/src/scss/pos.scss', 'pos_sms/static/src/scss/pos_sms.scss'),
        ],
    },
    'license': 'LGPL-3',
    'installable': True,
}
