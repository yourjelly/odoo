# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Star cloud printing',
    'version': '1.0',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': 'Cloud printing with Star printer support for Point Of Sale',
    'description': """
Allow Cloud Printing in POS
==============================

This module allows customers to print ticket without link a printer to an IoT Box.
The printer check every X secondes if there are a ticket to print.
You need config this url into the printer web base url:
http://ODOO-DB/pos_star_cloud

And in POS config select this type of printing.
Supported printer: All Star printer with "CloudPRNT" service and firmware 2.0
    """,
    'depends': [],
    'installable': True,
    'auto_install': False,
}
