# -*- coding: utf-8 -*-
{
    'name': "Manage Electronic Business Documents",
    'description': """
Electronic Data Interchange
=======================================
EDI is the electronic interchange of business information using a standardized format.

This is the base module to import/export your business documents.)
    """,
    'version': '1.0',
    'depends': ['mail'],
    'data': [
        'security/ir.model.access.csv',

        'views/edi_document_views.xml',

        'data/cron.xml'
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}
