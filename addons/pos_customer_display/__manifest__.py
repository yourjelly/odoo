{
    'name': 'PoS Customer Display',
    'version': '1.0.0',
    'category': 'Sales/Point of Sale',
    'summary': 'Display customer\'s order',
    'depends': ['point_of_sale'],
    'installable': True,
    'auto_install': True,
    'data': [
        'views/index.xml',
        'views/res_config_settings_views.xml',
        'views/point_of_sale_dashboard.xml',
    ],
    'assets': {
        'pos_customer_display.assets': [
            ('include', 'point_of_sale.base_app'),
            "point_of_sale/static/src/app/generic_components/**/*",
            "point_of_sale/static/src/utils.js",
            "pos_customer_display/static/src/app/**/*",
        ],
        'point_of_sale._assets_pos': [
            'pos_customer_display/static/src/overrides/**/*',
        ],
    },
    'license': 'LGPL-3',
}
