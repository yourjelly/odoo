{
    'name': 'Safety Stock',
    'depends': [
        'base',
        'stock'
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/safety_stock_views.xml',
        'views/safety_stock_menus.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'safety_stock/static/src/safety_stock.js',
            'safety_stock/static/src/safety_stock.xml',
            ]
    },
    'application': True,
}