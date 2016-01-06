{
    'name': 'Submit a Ticket',
    'category': 'Hidden',
    'summary': 'Helpdesk form to submit a ticket from your website',
    'description': 'Generic controller for web forms',
    'version': '1.0',
    'depends': ['website', 'mail', 'helpdesk'],
    'data': [
        'views/helpdesk_templates.xml',
        'data/helpdesk_website.xml',
    ],
    'installable': True,
    'auto_install': True,
}
