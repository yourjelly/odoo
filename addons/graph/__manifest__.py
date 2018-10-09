# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': "WhiskerGraph",

    'description': """
       The Generation of WhiskerGraph using actual and expected income of a salesperson.
    """,

    'author': "Parth",

    'application': "True",

    'category': 'Test',

    'depends': ['web', 'crm', 'sale_management'],

    'data': [
        'views/graph_whisker_view.xml',
        'views/graph_whisker_templates.xml'
    ],
    'qweb': [
        'static/src/xml/graph_whisker_template.xml'
    ],
}
