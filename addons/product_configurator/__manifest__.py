# -*- coding: utf-8 -*-

{
    'name': 'Product Configurator',
    'version': '1.0',
    'category': 'Sales',
    'depends': ['website_sale'],
    'description': """ This module allows user to easily configure the products with lot of variants""",
    'data': [
        'security/ir.model.access.csv',
        'security/security.xml',
        'wizard/product_configurator_views.xml',
        'views/product_template_views.xml',
        'views/product_attribute_views.xml',
        'views/sale_order_views.xml',
        'views/templates.xml',
    ],
    'qweb': ['static/src/xml/configurator.xml'],
    'installable': True,
    'auto_install': False,
}
