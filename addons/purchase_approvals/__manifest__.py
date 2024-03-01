# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Purchase Approvals',
    'version': '17.0.1.0',
    'category': 'Odoo S.A',
    'sequence': 35,
    'summary': 'Multiple approvals on Purchase orders',
    'website': 'https://www.odoo.com/app/purchase',
    'depends': ['purchase', 'approvals', 'base'],
    'data': [
        'views/purchase_views.xml',
        'views/approval_request_views.xml',
        'views/res_partner_views.xml',
    ],
    'installable': True,
    'license': 'LGPL-3',
}
