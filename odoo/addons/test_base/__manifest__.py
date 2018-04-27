# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'test-base',
    'version': '0.1',
    'category': 'Tests',
    'description': """A module to test orm, api, expression features.""",
    'depends': ['base'],
    'data': [
        'security/ir.model.access.csv',
        'views/views.xml',
        'datas/test_data.xml'
    ],
    'installable': True,
}
