# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    "name": """E-waybill Sale Purchase Stock""",
    "countries": ["in"],
    "version": "1.0",
    'category': 'Accounting/Localizations',
    "depends": [
        "l10n_in_ewaybill_sale_stock",
        "l10n_in_ewaybill_purchase_stock",
        "l10n_in_ewaybill_stock",
    ],
    "description": """It is created to set the Ship from address in case of Dropshipping""",
    'installable': True,
    'auto_install': True,
    "license": "LGPL-3",
}
