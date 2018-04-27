# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Invoice Factoring',
    'version': '1.0',
    'summary': 'Factoring',
    'sequence': 30,
    'description': """
    """,
    'category': 'Invoicing Management',
    'website': 'https://www.odoo.com/page/billing',
    'depends': ['account_invoicing', 'l10n_fr'],
    'data': [
        'views/res_config_settings_view.xml',
        'views/res_company_views.xml'
    ],
    'demo': [
    ],
    'qweb': [
    ],
    'application': True
}
