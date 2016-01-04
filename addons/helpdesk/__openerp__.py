# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Helpdesk',
    'version': '1.1',
    'website': 'https://www.odoo.com',
    'category': 'Helpdesk',
    'sequence': 10,
    'summary': 'Ticketing, Support, Issues',
    'depends': [
        'base_setup',
        'mail',
    ],
    'description': """
Omnichannel Helpdesk
====================

    """,
    'data': [
        'security/helpdesk_security.xml',
        'security/ir.model.access.csv',
        'data/helpdesk_data.xml',
        'views/helpdesk_view.xml',
        'views/helpdesk_team.xml',
    ],
    'demo': ['data/helpdesk_demo.xml'],
    'test': [
    ],
    'installable': True,
    'auto_install': False,
    'application': True,
}
