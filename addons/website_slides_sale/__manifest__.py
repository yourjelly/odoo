# -*- coding: utf-8 -*-
{
    'name': 'Slides Sale',
    'version': '1.0',
    'sequence': 145,
    'summary': 'Sale Courses',
    'category': 'Website',
    'description': """
Sale Courses'
======================================================

 * Website Application
 * Course Management
 * Lecture Management
 * Course Registration
 * Quizzes
 * Supported document types : PDF, images, YouTube videos and Google Drive documents)
""",
    'depends': ['website_slides', 'website_sale', 'survey'],
    'data': [
        'data/website_slides_sale_data.xml',
        'security/website_slides_sale_security.xml',
        'security/ir.model.access.csv',
        'views/website_slides_sale_backend.xml',
        'views/website_slides_sale_template.xml'
    ],
    'demo': [
    ],
    'installable': True,
}
