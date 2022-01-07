# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'Account Check Management',
    'version': "1.0.0",
    'category': 'Accounting/Localizations',
    'summary': 'Checks Management',
    'description': """
Extends 'Check Printing Base' module to:
* allow using own checks that are not printed but filled manually by the user
* allow to use checkbooks to track numbering
* add an optional "payment date" for postdated checks
* add a menu to track own checks

Also implement third checks management
""",
    'author': 'ADHOC SA',
    'license': 'LGPL-3',
    'images': [
    ],
    'depends': [
        'account_check_printing',
    ],
    'data': [
        'data/account_payment_method_data.xml',
        'security/ir.model.access.csv',
        'views/account_payment_view.xml',
        'views/l10n_latam_checkbook_view.xml',
        'views/account_journal_view.xml',
        'wizards/account_payment_register_views.xml',
        'wizards/account_payment_mass_transfer_views.xml',
    ],
    'demo': [
    ],
    'test': [
    ],
    'installable': True,
    'auto_install': False,
    'application': True,
}
