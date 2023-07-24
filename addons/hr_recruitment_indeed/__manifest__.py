# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Indeed Recruitment',
    'version': '1.1',
    'category': 'Human Resources/Recruitment',
    'sequence': 90,
    'website': 'https://www.odoo.com/app/recruitment',
    'depends': [
        'website_hr_recruitment',
    ],
    'data': [
        'data/job_feed_template.xml',
        'views/res_config_settings_views.xml',
        'views/hr_job_views.xml',
    ],
    'installable': True,
    'license': 'LGPL-3',
}
