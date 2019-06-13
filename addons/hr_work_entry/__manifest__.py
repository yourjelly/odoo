# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Work Entry",
    'category': "Human Resources",
    'sequence': 80,
    'summary': "Manages Work Entries",
    'description': "",
    'installable': True,
    'depends': [
        'resource', 'hr'
    ],
    'data': [
        'data/hr_work_entry_data.xml',
        'views/hr_work_entry_views.xml',
    ],
    'demo': [
        'data/hr_work_entry_demo.xml'
    ],

}
