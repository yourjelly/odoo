{
    'name': 'Safety Stock',
    'depends': [
        'base',
        'stock'
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/safety_stock_info.xml',
        'views/safety_stock_views.xml',
        'views/safety_stock_menus.xml',
    ],
    'application': True,
}