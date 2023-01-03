# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'HS Codes',
    'version': '1.0',
    'category': 'Accounting/Accounting',
    'depends': ['product'],
    'description': """
This module contains a representation of the WCO Harmonised System in Odoo.
========================================================================

The Harmonised System is defined by the World Customs Organisation, and used by many customs
authorities in many countries. It uses a heirarchical structure in order to classify goods, mapping
them to a 6 to 10 digit numberic code.

    HS Code structure: AABB CC DD EE
    AA - HS Chapter
    BB -- HS Heading
    CC --- HS Subheading
    DD ---- (Optional) Regional Tariff
    EE ----- (Optional) Country Tariff

    """,
    'data': [
        'data/product.hs.code.csv',
        'views/product_views.xml',
        'security/ir.model.access.csv',
            ],
    'assets': {
        'web.assets_backend': [
            'product_hs_code/static/src/**/*.js',
            'product_hs_code/static/src/**/*.xml',
        ],
    },
    # 'demo': [
    #     'data/product_demo.xml',
    # ],
    # 'installable': True,
    # },
    'license': 'LGPL-3',
}
