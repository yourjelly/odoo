# -*- coding: utf-8 -*-

{
    'name': 'Lunch Payment',
    'sequence': 120,
    'version': '1.0',
    'depends': ['lunch', 'payment'],
    'category': 'Human Resources',
    'summary': 'Handle payment for lunch',
    'description': """
This module adds payments to lunch
    """,
    'data': [
        'security/ir.model.access.csv',
        'views/lunch_payment_templates.xml',
        'wizard/lunch_payment_wizard_views.xml',
    ],
    'demo': [],
    'qweb': ['static/src/xml/lunch_kanban.xml'],
    'auto_install': True,
    'application': False,
}
