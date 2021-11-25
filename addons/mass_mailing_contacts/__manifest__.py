# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Mass mailing on contacts',
    'category': 'Hidden',
    'version': '1.0',
    'summary': 'Send mail through mass mailing',
    'description': """Mass Mailing on Contacts""",
    'depends': ['contacts', 'mass_mailing'],
    'data': [
        'views/mailing_mailing_views.xml',
        'views/res_partner.xml',
    ],
    'auto_install': True,
    'uninstall_hook': 'uninstall_hook',
    'license': 'LGPL-3',
}
