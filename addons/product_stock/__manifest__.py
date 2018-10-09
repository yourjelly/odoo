# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': "Product Stock Bubble Chart",
    'summary': """Bubble Chart""",
    'application': "True",
    'category': 'Test',
    'depends': ['base', 'web', 'stock', 'base_address_city'],
    'data': [
        'views/product_stockdata_templates.xml',
        'views/product_stockdata_views.xml',
        'data/city_data.xml',
        'data/product_data.xml'
    ],
    'qweb': [
        'static/src/xml/graph_view.xml'
    ]
}
