# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Share Post for Events',
    'version': '1.0',
    'category': 'Marketing/Events',
    'description': """Create share post campaigns for events.""",
    'depends': ['event', 'social_share'],
    'data': [
        'data/social_share_event_templates.xml',
        'views/event_event_views.xml',
    ],
    'installable': True,
    'auto_install': True,
    'license': 'OEEL-1',
}
