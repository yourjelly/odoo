# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'Romania - Accounting',
<<<<<<< HEAD
    'website': 'https://www.odoo.com/documentation/master/applications/finance/fiscal_localizations/romania.html',
||||||| parent of d9e3022e72f (temp)
    'website': 'https://www.odoo.com/documentation/master/applications/finance/fiscal_localizations.html',
=======
    'website': 'https://www.odoo.com/documentation/saas-16.4/applications/finance/fiscal_localizations/romania.html',
>>>>>>> d9e3022e72f (temp)
    'author': 'Fekete Mihai (NextERP Romania SRL), Odoo S.A.',
    'icon': '/account/static/description/l10n.png',
    'countries': ['ro'],
    'category': 'Accounting/Localizations/Account Charts',
    'version': '1.0',
    'depends': [
        'account',
        'base_vat',
    ],
    'description': """
This is the module to manage the Accounting Chart, VAT structure, Fiscal Position and Tax Mapping.
It also adds the Registration Number for Romania in Odoo.
================================================================================================================

Romanian accounting chart and localization.
    """,
    'data': [
        'views/res_partner_view.xml',
        'data/account_tax_report_data.xml',
        'data/res.bank.csv',
    ],
    'demo': [
        'demo/demo_company.xml',
    ],
    'license': 'LGPL-3',
}
