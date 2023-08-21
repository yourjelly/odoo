# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Default Theme',
    'description': 'Default website theme',
    'category': 'Theme',
    'sequence': 1000,
    'version': '1.0',
    'depends': ['website'],
    'images': [
        'static/description/cover.png',
        'static/description/theme_default_screenshot.jpg',
    ],
    'snippet_lists': {
        'homepage': ['s_cover', 's_text_image', 's_numbers'],
        'about_us': ['s_text_image', 's_image_text', 's_title', 's_company_team'],
        'our_services': ['s_three_columns', 's_quotes_carousel', 's_references'],
        'pricing': ['s_comparisons'],
        'privacy_policy': ['s_faq_collapse'],
    },
    'new_page_templates': {
        'about': {
            '1': ['s_table_of_content', 's_countdown', 's_picture', 's_showcase', 's_three_columns', 's_company_team', 's_quotes_carousel'],
        },
    },
    'license': 'LGPL-3',
}
