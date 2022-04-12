# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

# Copyright (C) 2010-2011 BAAMTU SARL (<http://www.baamtu.sn>).
# contact: leadsn@baamtu.com

{
    'name' : 'OHADA (révisé) - Accounting',
    'author' : 'Optesis',
    'category': 'Accounting/Localizations/Account Charts',
    'icon': '/l10n_syscohada/static/description/icon.jpeg',
    'description': """
This module implements the accounting chart for OHADA area.
===========================================================

It allows any company or association to manage its financial accounting.

Countries that use OHADA are the following:
-------------------------------------------
    Benin, Burkina Faso, Cameroon, Central African Republic, Comoros, Congo,

    Ivory Coast, Gabon, Guinea, Guinea Bissau, Equatorial Guinea, Mali, Niger,

    Republica of Democratic Congo, Senegal, Chad, Togo.
    """,
    'website': 'http://www.optesis.com',
    'depends' : [
        'account',
    ],
    'data': [
        'data/l10n_syscohada_chart_data.xml',
        'data/account.account.template.csv',
        'data/l10n_syscohada_chart_post_data.xml',
        'data/account.group.template.csv',
        'data/account_chart_template_data.xml',
    ],
    'demo': [
    ],
    'license': 'LGPL-3',
}
