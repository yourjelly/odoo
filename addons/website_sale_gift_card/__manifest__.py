# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "WebSite Sale Gift Card",
    'summary': "Use gift card in ecommerce",
    'description': """Integrate gift card mechanism in ecommerce.""",
    'category': 'Website/Website',
    'version': '1.0',
    'depends': ['website_sale', 'gift_card'],
    'application': False,
    'installable': True,
    'data': [
        'views/template.xml',
        'views/gift_card_views.xml',
        'views/product_views.xml',
        'views/sale_order_views.xml',
        'views/gift_card_menus.xml',
        'views/assets.xml',
    ]
}
