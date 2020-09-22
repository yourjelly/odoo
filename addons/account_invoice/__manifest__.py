# -*- coding: utf-8 -*-
{
    'name': 'account.invoice is back!',
    'version': '1.0',
    'summary': 'Invoices & Payments',
    'sequence': 10,
    'description': """""",
    'category': 'Accounting/Accounting',
    'depends': ['account'],
    'data': [
        'views/account_invoice_views.xml',
        'views/account_invoice_actions.xml',
        'views/ir_ui_menu_views.xml',
        'views/assets.xml',
    ],
    'qweb': [
        'static/src/xml/account_invoice_tax_group_widget.xml',
    ],
    'installable': True,
    'auto_install': False,
}
