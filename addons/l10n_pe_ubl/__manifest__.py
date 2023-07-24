{
    'name': 'Peru - e-Invoicing',
    'version': '1.0',
    'description': """
        This module defines the e-invoicing format for Peru, based on UBL 2.1 and lets you use the format on partners.
    """,
    'author': 'Odoo S.A.',
    'license': 'LGPL-3',
    'category': 'Accounting/Localizations',
    'countries': ['pe'],
    'depends': [
        'account_edi_ubl_cii',
        'l10n_pe',
    ],
    'data': [
        'data/pe_ubl_templates.xml',
    ],
    'auto_install': True,
}
