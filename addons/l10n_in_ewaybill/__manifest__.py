# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    "name": """E-waybill""",
    "countries": ["in"],
    "version": "1.0",
    "category": "Accounting/Localizations/EDI",
    "depends": [
        "l10n_in", "l10n_in_edi", "l10n_in_edi_ewaybill",
    ],
    "description": """Ewaybill""",
    "data": [
        "security/ir.model.access.csv",
        "views/account_move_views.xml",
        "views/l10n_in_ewaybill_views.xml",
    ],
    "installable": True,
    "license": "LGPL-3",
}