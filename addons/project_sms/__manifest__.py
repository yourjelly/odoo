# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Project - SMS",
    'summary': 'Send text messages when project/task stage move',
    'description': "Send text messages when project/task stage move",
    'category': 'Hidden',
    'version': '1.0',
    'depends': ['project', 'sms'],
    'data': [
        'views/project_views.xml',
        'security/ir.model.access.csv',
        'security/sms_security.xml',
    ],
    'application': False,
    'auto_install': True,
    'license': 'LGPL-3',
}
