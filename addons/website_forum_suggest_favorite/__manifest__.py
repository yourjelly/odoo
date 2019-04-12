# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Forum Suggest Favorite',
    'category': 'Website',
    'sequence': 150,
    'summary': 'Add Possibility To Suggest A Question As Favorite To Someone',
    'version': '1.0',
    'description': """
Suggest Question, Read Question, No Distractions
        """,
    # 'website': 'https://www.odoo.com/page/community-builder',
    'depends': [
        'website_forum',
    ],
    'data': [
        'data/action.xml',
        'views/website_forum.xml',
    #     'views/website_forum_profile.xml',
    #     'views/ir_qweb.xml',
    #     'security/ir.model.access.csv',
    #     'data/badges_question.xml',
    #     'data/badges_answer.xml',
    #     'data/badges_participation.xml',
    #     'data/badges_moderation.xml',
    ],
    'qweb': [
        # 'static/src/xml/*.xml'
    ],
    'demo': [
        # 'data/forum_demo.xml',
    ],
    'installable': True,
    'application': True,
    # True ?
}
