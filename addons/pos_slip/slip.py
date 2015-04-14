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

import logging

import openerp

from openerp import tools
from openerp.osv import fields, osv

class pos_config(osv.osv):
    _inherit = 'pos.config' 

    POS_PRINT_SLIP = [
        ('never','Never'),
        ('bill','Bill'),
        ('receipt','Receipt'),
        ('always','Always')
    ]

    _columns = {
        'receipt_slip': fields.selection(POS_PRINT_SLIP, 'Slip Printing', help='Receipts and bills will be printed on multi-page slip receipts instead of the usual thermal roll paper'),
        'receipt_slip_heading': fields.integer('Slip Heading', help='The number of lines before the content, used to vertically center the receipt'),
        'receipt_slip_lines':   fields.integer('Slip Lines', help='The number of lines printed on slip receipts'),
        'receipt_slip_width':   fields.integer('Slip Width', help='The width of the slip receipts (in characters)'),
    }

    _defaults = {
        'receipt_slip': 'never',
        'receipt_slip_heading': 2,
        'receipt_slip_lines':   15,
        'receipt_slip_width':   40,
    }

