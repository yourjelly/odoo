# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'Forum Digest',
    'category': 'Internal',
    'description': """
Send Forum Digests periodically to employees
=============================
""",
    'version': '1.0',
    'depends': [
        'digest',
        'website_forum',
    ],
    'data': [,
        'data/digest_template_data.xml',
    ],
    'installable': True,
}
