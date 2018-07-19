# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Partner',
    'category': 'Tools',
    'summary': 'Partner, Partner category',
    'version': '1.0',
    'description': """
Extedn Partner.
""",
    'depends': ['base'],
    'data': [
        'views/partner_views.xml',
        'views/res_bank_views.xml',
        'security/ir.model.access.csv',
        'security/bank_security.xml',
    ],
    'demo': [
        'data/res_partner_bank_demo.xml',
        'data/res_partner_demo.xml',
        'data/res_partner_data.xml',
        'data/res_bank_demo.xml',
    ],
    'installable': True,
    'auto_install': False,
}
