# -*- coding: utf-8 -*-
{
    'name' : 'Import/Export Invoices From XML/PDF',
    'description':"""
Electronic Data Interchange
=======================================
EDI is the electronic interchange of business information using a standardized format.

This is the base module for import and export of invoices in various EDI formats, and the
the transmission of said documents to various parties involved in the exchange (other company,
governements, etc.)
    """,
    'version' : '1.0',
    'category': 'EDI',
    'depends' : ['base'],
    'data': [
        'security/ir.model.access.csv',
        'views/account_edi_document_views.xml',
        'data/cron.xml'
    ],
    'installable': True,
    'application': False,
    'auto_install': True,
}
