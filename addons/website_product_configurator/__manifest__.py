# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'eCommerce Product Configurator',
    'version': '1.0',
    'category': 'Sales',
    'depends': ['product_configurator', 'website_sale'],
    'description': """ This module allows shoppers to easily build on demand variants from the eCommerce """,
    'data': [
        'views/templates.xml',
    ],
    'installable': True,
    'auto_install': False,
}
