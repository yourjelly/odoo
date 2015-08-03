# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'Blackbox Hardware Driver',
    'version': '1.0',
    'category': 'Hardware Drivers',
    'sequence': 6,
    'summary': 'Hardware Driver for Belgian Fiscal Data Modules',
    'website': 'https://www.odoo.com/page/point-of-sale',
    'description': """
TODO JOV
========

add some stuff here
""",
    'author': 'OpenERP SA',
    'depends': ['hw_proxy'],
    'external_dependencies': {'python': ['serial']},
    'test': [
    ],
    'installable': True,
    'auto_install': False,
}
