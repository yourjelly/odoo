# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'Luxembourg - Accounting',
    'version': '2.1',
    'category': 'Accounting/Localizations/Account Charts',
    'description': """
This is the base module to manage the accounting chart for Luxembourg.
======================================================================

    * the Luxembourg Official Chart of Accounts (law of June 2009 + 2015 chart and Taxes),
    * the Tax Code Chart for Luxembourg
    * the main taxes used in Luxembourg
    * default fiscal position for local, intracom, extracom

Notes:
    * the 2015 chart of taxes is implemented to a large extent,
      see the first sheet of tax.xls for details of coverage
    * to update the chart of tax template, update tax.xls and run tax2csv.py
""",
    'author': 'Odoo S.A., ADN, ACSONE SA/NV',
    'depends': [
        'account',
        'base_iban',
        'base_vat',
    ],
    'data': [
        'data/l10n_lu_chart_data.xml',
        'data/account_tax_report_line.xml',
    ],
    'demo': [
        'demo/demo_company.xml',
    ],
    'post_init_hook': '_post_init_hook',
    'license': 'LGPL-3',
}
