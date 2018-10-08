# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'RFID Hardware Driver',
    'category': 'Human Resources',
    'sequence': 7,
    'summary': 'Hardware Driver for RFID',
    'description': """
RFID Hardware Driver
=======================

""",
    'depends': ['hw_proxy'],
    'external_dependencies': {
        'python' : ['pi-rc522'],
    },
    'installable': False,
}
