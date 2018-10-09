{
    'name': 'Job Seeker Chart',
    'version': '1.0',
    'category': 'Graph',
    'summary': 'Job Seeker Chart (By Location and Job Profile)',
    'description': """Job Seeker Chart will display candidates applied for Job either by Location or Job Profile""",
    'depends': ['web', 'hr_recruitment'],
    'data': [
        'views/job_seeker_templates.xml',
        'views/job_seeker_views.xml',
    ],
    'installable': True,
    'application': True,
    'qweb': [
        "static/src/xml/widget_templates.xml"
    ]
}
