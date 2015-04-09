# -*- coding: utf-8 -*-
##############################################################################
#
#    OpenERP, Open Source Management Solution
#    Copyright (C) 2004-2010 Tiny SPRL (<http://tiny.be>).
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as
#    published by the Free Software Foundation, either version 3 of the
#    License, or (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
##############################################################################


{
    'name': 'Point of Sale Slip Printing',
    'version': '1.0',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': 'Multi-Page Slip Printing for the point of sale',
    'description': """

=======================

This module allows to print multi-page slip receipts instead of
regular receipts. This is mainly useful when thermally
printed receipts are not acceptable, and regular ink must be used.

This module requires a posbox and
a ESC/POS compatible slip printer such as the EPSON TM-J7500.

""",
    'author': 'OpenERP SA',
    'depends': ['pos_restaurant'],
    'data': [
        'views/views.xml',
        'views/templates.xml'
    ],
    'installable': True,
    'website': 'https://www.odoo.com/page/point-of-sale',
    'auto_install': False,
}

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
