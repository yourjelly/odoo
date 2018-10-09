# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': "Odoo deliverable task",

    'summary': "Odoo Project",

    'depends': ['mail', 'web'],

    'description': """
        Demo Project
    """,

    'data': [
       'views/activity_views.xml',
       'views/activity_templates.xml',
    ],

    'qweb': [
        "static/src/xml/activity_graph.xml",
    ],

    'application': True,
}
