# -*- encoding: utf-8 -*-
##############################################################################
#
#    ODOO Addon module by Sprintit Ltd
#    Copyright (C) 2018 Sprintit Ltd (<http://sprintit.fi>).
#
#    Part of Odoo. See LICENSE file for full copyright and licensing details.
#
##############################################################################

{
    "name": "Finnish Localization",
    "version": "13.0.1",
    "author": "Sprintit",
    "author": "Avoin.Systems, "
              "Tawasta, "
              "Vizucom, "
              "Sprintit",
    "category": "Localization",
    "description": "This is the Odoo module to manage the accounting in Finland.",
    "depends": [
        'account',
        'base_iban',
        'base_vat',
    ],
    "data": [
        "data/res_partner_operator_einvoice_data.xml",
        "security/ir.model.access.csv",
        'data/account_account_tag_data.xml',
        'data/account_chart_template_data.xml',
        'data/account.account.template.csv',
        'data/account_tax_report_line.xml',
        'data/account_tax_template_data.xml',
        'data/l10n_fi_chart_post_data.xml',
        'data/account_fiscal_position_template_data.xml',
        'data/account_chart_template_configuration_data.xml',
        "views/menuitems.xml",
        "views/res_company_views.xml",
        "views/res_config_settings_views.xml",
        "views/res_partner_operator_einvoice_views.xml",
        "views/res_partner_views.xml",
    ],
    "active": True,
    "installable": True,
}
