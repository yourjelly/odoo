# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': "zoo",
    'version': '1.0',
    'category': 'zoo',
    'sequence': 6,
    'summary': 'Sum',
    'author': "Vike team",
    'depends': ['contacts'],
    'data': [
        'security/ir.model.access.csv',
        'views/zoo_view.xml',
        'views/animal.xml',
    ],
    'application': True,
    'installable': True,
    'license': 'LGPL-3',
}
