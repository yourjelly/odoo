# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Pos no edit',
    'version': '1.0',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': 'Implements the registered cash system',
    'description': """

**
    """,
    'depends': ['pos_restaurant'],
    'data': [
        'views/pos_no_edit_assets.xml'
    ],
    'installable': True,
    'auto_install': True,
    'license': 'OEEL-1',
}
