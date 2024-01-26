# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Project Product",
    'version': '1.0',
    'summary': "Project settings on service type products",
    'category': 'Hidden',
    'depends': ['product', 'project'],
    'data': [
        'views/product_views.xml',
    ],
    'auto_install': True,
    'license': 'LGPL-3',
}
