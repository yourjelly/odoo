# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    "name": """Indian E-waybill""",
    "countries": ["in"],
    "version": "1.0",
    "category": "Accounting/Localizations/EDI",
    "depends": [
        "l10n_in",
    ],
    "description": """Ewaybill""",
    "data": [
        "data/cron.xml",
        "data/ewaybill_type_data.xml",
        "security/ir.model.access.csv",
        "views/account_move_views.xml",
        "views/l10n_in_ewaybill_views.xml",
        "views/res_config_settings_views.xml",
    ],
    "demo": [
        "demo/demo_company.xml",
        "demo/res_partner_demo.xml",
        "demo/account_invoice_demo.xml",
    ],
    "installable": True,
    "license": "LGPL-3",
}
