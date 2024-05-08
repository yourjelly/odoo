# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'Deliveroo Integration Point of Sale',
    'category': 'Sales/Point of Sale',
    'depends': ['pos_food_delivery_service'],
    'license': 'LGPL-3',
    'data': [
        'data/pos_online_delivery_provider_data.xml',
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'pos_urban_piper/static/src/**/*',
        ],
    },
}
