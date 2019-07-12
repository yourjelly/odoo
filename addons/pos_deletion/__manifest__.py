# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'pos deletion',
    'version': '1.0',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': '...',
    'description': """

    """,
    'depends': ['point_of_sale'],
    'data': [

    ],
    'demo': [
        'data/pos_blackbox_be_demo.xml',
    ],
    'qweb': [
        'static/src/xml/pos_blackbox_be.xml'
    ],
    'installable': True,
    'auto_install': True,
}
