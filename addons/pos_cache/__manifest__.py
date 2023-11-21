{
    'name': "PoS Cache",
    'summary': "Enable a cache on the POS data to increase loading time and reduce server load.",
    'category': 'Sales/Point of Sale',
    'version': '1.0',
    'depends': ['point_of_sale', 'pos_loyalty'],
    'data': [
        'data/pos_cache_data.xml',
        'security/ir.model.access.csv',
        'views/res_config_settings_views.xml',
        'views/pos_cache_views.xml',
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'pos_cache/static/**/*',
        ],
    },
    'license': 'LGPL-3',
}
