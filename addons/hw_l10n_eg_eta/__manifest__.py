# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Egypt ETA Hardware Driver',
    'category': 'Accounting/Accounting',
    'sequence': 6,
    'website': 'https://www.odoo.com',
    'summary': 'Egypt ETA Hardware Driver',
    'description': """
Egypt ETA Hardware Driver
=======================

This module allows Odoo to digitally sign invoices using the USB key provided by Egypt Trust

Requirements per system
-----------------------

Windows:
    - Microsoft visual c++ 14.0 or higher (windows only)
    - eps2003csp11.dll
    
Linux/macOS:
    - OpenSC

""",
    'external_dependencies': {
        'python': ['pkcs11'],
    },
    'installable': False,
    'license': 'LGPL-3',
}
