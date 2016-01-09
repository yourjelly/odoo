{
    'name': 'Helpdesk: Knowledge Base',
    'category': 'Website',
    'summary': 'Knowledge base for helpdesk',
    'description': 'Knowledge base for helpdesk based on Odoo Forum',
    'version': '1.0',
    'depends': ['website_forum', 'website_slides', 'helpdesk_website'],
    'data': [
        'views/helpdesk_templates.xml',
        'views/helpdesk_team.xml',
        'security/ir.model.access.csv',
    ],
    'installable': True,
    'auto_install': False,
}
