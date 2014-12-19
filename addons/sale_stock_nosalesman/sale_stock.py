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

from openerp.osv import osv

class stock_move(osv.osv):
    _inherit = 'stock.move'

    def _get_master_data(self, cr, uid, move, company, context=None):
        if move.procurement_id and move.procurement_id.sale_line_id:
            sale_order = move.procurement_id.sale_line_id.order_id
            return sale_order.partner_invoice_id, uid, sale_order.pricelist_id.currency_id.id
        return super(stock_move, self)._get_master_data(cr, uid, move, company, context=context)
