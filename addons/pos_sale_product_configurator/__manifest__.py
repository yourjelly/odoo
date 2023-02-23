# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


{
    'name': 'POS - Sale Product Configurator',
    'version': '1.0',
    'category': 'Hidden',
    'summary': 'Link module between point_of_sale and sale_product_configurator',
    'description': """
This module adds features depending on both modules.
""",
    'depends': ['point_of_sale', 'sale_product_configurator'],
    'installable': True,
    'auto_install': True,
    'assets': {
        'point_of_sale.assets': [
            'pos_sale_product_configurator/static/src/js/models.js',
            'pos_sale_product_configurator/static/src/css/popups/product_info_popup.css',
            'pos_sale_product_configurator/static/src/xml/**/*'
        ]
    },
    'license': 'LGPL-3',
}
