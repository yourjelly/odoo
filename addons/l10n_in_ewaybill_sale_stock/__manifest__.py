# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    "name": """E-waybill Sale Stock""",
    "countries": ["in"],
    "version": "1.0",
    'category': 'Accounting/Localizations/Sale',
    "depends": [
        "sale",
        "l10n_in_ewaybill_stock",
    ],
    "description": """It is created to set the Ewaybill Price and Taxes according to Sales Order""",
    'installable': True,
    'auto_install': True,
    "license": "LGPL-3",
}
