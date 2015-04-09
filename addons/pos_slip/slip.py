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
    _columns = {
        'receipt_slip': fields.boolean('Slip Receipts', help='This printer will print multi-page slip receipt instead of the regular roll receipts'),
        'receipt_slip_lines': fields.integer('Slip Lines', help='The number of lines printed on slip receipts'),
        'receipt_slip_width':  fields.integer('Slip Width', help='The width of the slip receipts (in characters)'),
    }
    _defaults = {
        'receipt_slip': False,
        'receipt_slip_lines': 100,
        'receipt_slip_width':  40,
    }

