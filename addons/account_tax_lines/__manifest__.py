# -*- coding: utf-8 -*-
{
    'name': "Split Tax Lines",

    'summary': """
        Split the tax lines on Journal Entry""",

    'description': """
Split tax lines on journal entries for invoice, credit note or vendor bill.

Useful when you have to compute the values of the taxes on each lines of invoice, credit note or vendor bill.
This app will add the Matching Ref field in account.move.line, using that you can identify the invoice/bills/credit or debit notes line and its tax lines.
    """,

    'author': "Odoo S.A",
    'website': "http://www.odoo.com",

    # Categories can be used to filter modules in modules listing
    # Check https://github.com/odoo/odoo/blob/14.0/odoo/addons/base/data/ir_module_category_data.xml
    # for the full list
    'category': 'Accounting/Accounting',
    'version': '0.1',

    # any module necessary for this one to work correctly
    'depends': ['base', 'account'],

    # always loaded
    'data': [

    ],
    # only loaded in demonstration mode
    'demo': [

    ],
}
