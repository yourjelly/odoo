# -*- coding: utf-8 -*-

{
    'name': 'DBC',

    'summary': "custom dev for DBC",

    'description': """
    Force invoice every pos_order

""",

    'category': 'Point of Sale',
    'version': '1.0',

    'depends': ['point_of_sale'],
    'installable': True,
    'auto_install': True,
    'assets': {
        'point_of_sale._assets_pos': [
            'dbc/static/src/**/*'
        ],
    },
    'license': 'OEEL-1',
}
