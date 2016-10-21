# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Website Portal for Purchases',
    'category': 'Website',
    'summary': 'Add your purchase orders in the frontend portal',
    'version': '1.0',
    'description': """
Add your purchase orders in the frontend portal. Your customers will be able to connect to their portal to see the list (and the state) of their purchase orders.
        """,
    'depends': [
        'purchase',
        'website_portal',
    ],
    'data': [
        'views/website_portal_purchase_templates.xml',
        'security/ir.model.access.csv',
    ],
    'demo': [
    ],
    'installable': True,
}
