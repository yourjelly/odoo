# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Website Sale Odoo Payment',
    'category': 'Hidden',
    'summary': 'Odoo payment in e-commerce app',
    'version': '0.1',
    'description': """This module adds odoo payment menus in e-commerce app menus""",
    'depends': ['website_sale', 'odoo_payments'],
    'data': [
        'views/odoo_payment_menus.xml',
    ],
    'auto_install': True,
    'license': 'LGPL-3',
}
