# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Opportunity to Quotation bridge module',
    'version': '1.0',
    'category': 'Hidden',
    'description': """
Bridge module between the sale_management, sale_renting and crm apps. 
It allows you to generate a sales order based on the selected case.
If different cases are open (a list), it generates one sales order by case.
The case is then closed and linked to the generated sales orderßßß
""",
    'depends': ['sale', 'crm'],
    'data': [
        'views/sale_order_views.xml',
        'views/crm_lead_views.xml',
        'wizard/crm_opportunity_to_quotation_views.xml'
    ],
    'auto_install': True,
}
