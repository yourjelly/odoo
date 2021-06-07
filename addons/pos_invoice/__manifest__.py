# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    "name": "pos_invoice",
    "category": "Hidden",
    "summary": "Pay invoices thru POS",
    "description": """This module allows payment of invoices through the Point of Sale Application.""",
    "depends": ["point_of_sale"],
    "data": [
        "views/pos_order_view.xml",
        "views/pos_config_views.xml",
    ],
    "installable": True,
    "auto_install": False,
    "assets": {
        "point_of_sale.assets": [
            "pos_invoice/static/src/css/pos.css",
            "pos_invoice/static/src/js/**/*.js",
        ],
        "web.assets_tests": [],
        "web.assets_qweb": [
            "pos_invoice/static/src/xml/**/*.xml",
        ],
    },
}
