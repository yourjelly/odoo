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
 * Supported document types : PDF, images, YouTube videos and Google Drive documents)
""",
    'depends': ['website_slides', 'website_sale'],
    'data': [
        'views/website_slides_sale_backend.xml'
    ],
    'demo': [
    ],
    'installable': True,
}
