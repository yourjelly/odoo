{
    'name': 'Adds MRP cost to Product Margin Report ',
    'description': """
    Adds MRP cost to Product's Margin Report
""",
    'depends': ['account', 'mrp', 'product_margin', 'stock_account'],
    'data': [
        'views/stock_valuation_layer_views.xml'
    ],
    'installable': True,
    'auto_install': True,
    'license': 'LGPL-3',
}
