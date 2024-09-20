# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'HS Codes',
    'category': 'Tools',
    'summary': 'HS Customs codes',
    'description': """
    Allows configuration of HS codes on the product.
""",
    'depends': ['product'],
    'data': [
        'data/product.customs_code.csv',
        'views/product_views.xml',
    ],
    'installable': True,
    'application': True,
    'license': 'OEEL-1',
}
