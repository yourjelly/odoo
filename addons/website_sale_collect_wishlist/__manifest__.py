# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Collect & Wishlist",
    'category': 'Website/Website',
    'summary': "Bridge module for Website sale collect and wishlist",
    'description': """
Allow users to add products to their wishlist if the selected pickup location is out of stock.
    """,
    'depends': ['website_sale_wishlist', 'website_sale_collect'],
    'data': [
        'views/delivery_form_templates.xml',
    ],
    'auto_install': True,
    'license': 'LGPL-3',
}
