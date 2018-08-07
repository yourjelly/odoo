# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


{
    'name': 'Internet of Things',
    'category': 'Tools',
    'summary': 'Basic models and helpers to support Internet of Things.',
    'description': """
This module provides management of your IoT boxes inside Odoo.
""",
    'depends': ['web'],
    'data': [
        'security/iot.xml',
        'security/ir.model.access.csv',
        'views/iot_views.xml',
        'views/res_users_view.xml',
    ],
    'qweb': [
        #'static/src/xml/iap_templates.xml',
    ],
    'auto_install': False,
}
