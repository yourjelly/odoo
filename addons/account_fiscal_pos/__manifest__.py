{
    'name': "Fiscal Position Flexibility Features",
    'version': '1.0',
    'category': 'Accounting/Accounting',
    'description': """
Flexibility Features for Fiscal Positions
===========================
This module provides additional flexibility features for fiscal positions:
    - Allows the creation of multiple fiscal positions with foreign VAT numbers in the same region.
    - Checks the country of the foreign VAT number matches the country on the fiscal position.
    - Allows the assignment of a country to a fiscal position with a foreign VAT number.
    - Allows the assignment of a state to a fiscal position with a foreign VAT number.

    """,
    'depends': ['account'],
    'data': [
        'views/account_fiscal_position.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': True,
    'license': 'LGPL-3',
}
