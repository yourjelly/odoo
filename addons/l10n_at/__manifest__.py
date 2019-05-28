# -*- coding: utf-8 -*-
# © 2015 WT-IO IT GmbH <https://www.wt-io-it.at>
# See LICENSE file for full copyright and licensing details.

{
    "name": "Austrian Localization",
    "version": "1.0",
    "sequence": 12,
    "author": "WT-IO-IT GmbH, Wolfgang Taferner",
    "website": "https://www.wt-io-it.at",
    "license": 'Other proprietary',
    "category": "Localization",
    'summary': "Austrian Standarized Charts & Tax",
    "description": """""",
    "depends": [
        'account',
        'base_iban',
        'base_vat',
    ],
    "demo": [],
    "data": [
        'data/account_account_tag.xml',
        'data/account_account_template.xml',
        'data/account_tax_group.xml',
        'data/account_chart_template.xml',
        'data/account_tax_template.xml',
        'data/account_fiscal_position_template.xml',
        'data/account_chart_template_configure_data.xml',
    ],
    'test': [],
    'installable': True,
    'application': False,
}
