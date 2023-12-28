# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    "name": "Hungarian Invoicing Localisation",
    "version": "16.0.1.0.0",
    "icon": "/l10n_hu/static/description/icon.png",
    "category": "Accounting/Localizations/EDI",
    "author": "OdooTech Zrt. & BDSC Business Consulting Kft.",
    "description": """
Hungarian Invoicing extension.
==============================

With this module you can issue a hungarian invoice.
    """,
    "website": "https://www.odootech.hu",
    "depends": [
        "account_edi",
        "l10n_hu",
    ],
    "data": [
        "security/ir.model.access.csv",
        "data/account.tax.template.csv",
        "data/account_cash_rounding.xml",
        "data/template_requests.xml",
        "data/template_invoice.xml",
        "data/uom_uom.xml",
        "data/account_edi_data.xml",
        "views/report_templates.xml",
        "views/report_invoice.xml",
        "views/l10n_hu_edi_transaction_views.xml",
        "views/l10n_hu_edi_credentials_views.xml",
        "views/account_move_views.xml",
        "views/product_template_views.xml",
        "views/account_tax_views.xml",
        "views/uom_uom_views.xml",
        "views/res_partner_views.xml",
        "views/res_company_views.xml",
        "views/res_config_settings_views.xml",
    ],
    "demo": [
        "demo/demo_partner.xml",
    ],
    "post_init_hook": "post_init",
    "installable": True,
    "auto_install": ["l10n_hu"],
    "license": "LGPL-3",
}
