{
    'name': 'Point of Sale online payment customer display',
    'depends': ['pos_customer_display', 'pos_online_payment'],
    'auto_install': True,
    'installable': True,
    'assets': {
        'pos_customer_display.assets': [
            'pos_online_payment_customer_display/static/src/overrides_pos_customer_display/**/*',
            'pos_online_payment/static/src/app/online_payment_popup/**/*',
        ],
        'point_of_sale.assets_prod': [
            'pos_online_payment_customer_display/static/src/overrides_pos_online_payment/**/*',
        ],
    },
    'license': 'LGPL-3',
}
