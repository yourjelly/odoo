# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'PROJECT - Skills',
    'summary': 'Project skills',
    'description': """
        Search project tasks slots by skill
    """,
    'category': 'Services/Project',
    'version': '1.0',
    'depends': ['project', 'hr_skills'],
    'auto_install': True,
    'data': [
        'views/project_task_views.xml',
        'views/project_sharing_project_task_views.xml',
    ],
    'license': 'OEEL-1',
}
