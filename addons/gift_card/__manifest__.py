# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Sale Gift Card",
    'summary': "Use gift card in sales orders",
    'description': """Integrate gift card mechanism in sales orders.""",
    'category': 'Sales/Sales',
    'version': '1.0',
    'depends': ['sale'],
    'application': False,
    'installable': True,
    'data': [
        'data/gift_card_template_email.xml',
        'data/gift_card_data.xml',
        'data/gift_card_cron.xml',
        'security/ir.model.access.csv',
    ]
}
