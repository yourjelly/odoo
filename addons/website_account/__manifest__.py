# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Website Portal for Invoices',
    'category': 'Website',
    'summary': 'Add your invoices document in the frontend portal',
    'version': '1.0',
    'description': """
Add your invoices document in the frontend portal.
Your customers will be able to connect to their portal to see the list (and the state) of their invoices (pdf report).
    """,
    'depends': [
        'account',
        'website_payment'
    ],
    'data': [
        'views/website_account_templates.xml',
        'views/account_invoice_views.xml',
        'views/payment_acquirer_views.xml',
        'security/ir.model.access.csv',
        'security/account_invoice_security.xml',
    ],
    'demo': [
        'data/email_template_data_invoice.xml'
    ],
    'installable': True,
}
