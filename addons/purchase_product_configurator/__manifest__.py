{
    'name':"Purchase Product Configurator",
    'depends':['base','purchase'],
    'installable': True,
    'auto_install': True,
    'data': [
                'views/purchase_views.xml',
                'views/templates.xml',
             ],
    'assets': {
        'web.assets_backend': [
            'purchase_product_configurator/static/src/**/*',
        ],
    },
    'license': 'LGPL-3',
}