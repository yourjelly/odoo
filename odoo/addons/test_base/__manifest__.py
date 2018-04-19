# -*- coding: utf-8 -*-
{
    'name': 'test-base',
    'version': '0.1',
    'category': 'Tests',
    'description': """A module to verify the inherit and inherits""",
    'depends': ['base'],
    'data': [
        'security/ir.model.access.csv',
        'views/view.xml',
        'datas/demo_data.xml'
    ],
    'installable': True,
    'auto_install': False,
}
