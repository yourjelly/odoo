# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

# Copyright (c) 2011 Noviat nv/sa (www.noviat.be). All rights reserved.

from openerp.osv import fields, osv
import time
from openerp.tools.translate import _

class res_partner(osv.osv):  
    """ add field to indicate default 'Communication Type' on customer invoices """
    _inherit = 'res.partner'
    
    def _get_comm_type(self, cr, uid, context=None):
        res = self.pool.get('account.invoice')._get_reference_type(cr, uid,context=context)
        return res

    def _commercial_fields(self, cr, uid, context=None):
        return super(res_partner, self)._commercial_fields(cr, uid, context=context) + \
            ['out_inv_comm_type', 'out_inv_comm_algorithm']

    out_inv_comm_type = fields.Selection('_get_comm_type', string='Communication Type', change_default=True,
            help='Select Default Communication Type for Outgoing Invoices.')
