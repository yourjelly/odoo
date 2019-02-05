# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'HR pin',
    'version': '1.0',
    'category': 'Human Resources',
    'sequence': 85,
    'summary': 'Add a badge ID and a pin to employees',
    'description': "Pin and barcodes are used to identify employees.",
    'website': 'https://www.odoo.com/page/employees',
    'depends': ['hr'],
    'installable': True,
    'data': [
        'views/hr_employee.xml',
    ],
}
