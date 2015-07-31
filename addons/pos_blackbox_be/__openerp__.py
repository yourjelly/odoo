# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Registered Cash Register System',
    'version': '1.0',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': 'Implements the registered cash system, adhering to guidelines by FPS Finance.',
    'description': """
TODO
====

add some stuff here
    """,
    'author': 'Odoo SA',
    'depends': ['web', 'barcodes', 'point_of_sale'],
    'website': '',
    'data': [
        'views/res_users.xml',
        'views/pos_blackbox_assets.xml',
        'data/pos_blackbox_be_data.xml'
    ],
    'demo': [
        'data/pos_blackbox_be_demo.xml'
    ],
    'qweb': [
    ],
    'installable': True,
    'auto_install': False,
}
