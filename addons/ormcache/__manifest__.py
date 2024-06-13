# -*- coding: utf-8 -*-

{
    'name': 'ORM Cache Usage',
    'sequence': 300,
    'version': '1.0',
    'depends': ['base', 'web'],
    'category': 'ORM',
    'data': [
        'security/ir.model.access.csv',
        'views/orm_cache_usage.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'ormcache/static/src/views/*.js',
            'ormcache/static/src/views/*.xml',
        ],
    },
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}
