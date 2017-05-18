# -*- coding: utf-8 -*-
{
    'name': "Event: Exhibitors",
    'description': """Exhibitors, Stands, Slots""",
    'summary': """
        Allows to define your exhibition plan and sell stands. This module has
        been developed for Odoo Experience and is very specific to Odoo's own
        needs.
    """,
    'author': "Odoo SA",
    'website': "https://www.odo.com",
    'category': 'Marketing',
    'version': '1.0',
    'depends': ['website_event_track', 'website_sale', 'decimal_precision'],
    'data': [
        'security/ir.model.access.csv',
        'views/views.xml',
        'views/templates.xml',
        'data/event_stand_data.xml'
    ],
    'demo': [
        'demo/demo.xml',
    ],
}
