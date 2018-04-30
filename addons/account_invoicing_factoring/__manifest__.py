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
    'depends': ['l10n_fr'],
    'data': [
        'data/factoring_data.xml',
        'views/res_config_settings_view.xml',
        'views/res_company_views.xml',
        'views/factoring_views.xml'
    ],
    'demo': [
    ],
    'qweb': [
    ],
    'application': True
}
