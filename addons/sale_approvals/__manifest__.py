# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Sale Approvals',
    'version': '17.0.1.0',
    'category': 'Odoo S.A',
    'sequence': 35,
    'summary': 'Multiple approvals on Sales orders',
    'website': 'https://www.odoo.com/app/sales',
    'depends': ['sale_management', 'approvals', 'contacts', 'base'],
    'data': [
        'views/sale_views.xml',
        'views/approval_request_views.xml',
        'views/res_partner_views.xml',
    ],
    'installable': True,
    'license': 'LGPL-3',
}