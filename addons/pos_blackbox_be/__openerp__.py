# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Registered Cash Register System',
    'version': '1.0',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': 'Implements the registered cash system, adhering to guidelines by FPS Finance.',
    'description': """
TODO JOV
========

add some stuff here
    """,
    'author': 'Odoo SA',
    'depends': ['web', 'point_of_sale', 'l10n_be'],
    'website': '',
    'data': [
        'views/res_users.xml',
        'views/point_of_sale.xml',
        'views/pos_blackbox_assets.xml',
        'data/pos_blackbox_be_data.xml'
    ],
    'demo': [
        'data/pos_blackbox_be_demo.xml'
    ],
    'qweb': [
        'static/xml/pos_blackbox_be.xml'
    ],
    'installable': True,
    'auto_install': False,
}
