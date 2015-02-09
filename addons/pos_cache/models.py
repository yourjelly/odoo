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
from datetime import datetime
import cPickle

from openerp import models, fields, api

class pos_cache(models.Model):
    _name = 'pos.cache'

    cache = fields.Binary()
    cachetime = fields.Datetime()
    config_ids = fields.One2many('pos.config', 'cache_id', 'Config')
    
    @api.one
    def refresh_cache(self):
        products = self.env['product.product'].search(self.get_domain())
        res = products.with_context(pricelist=self.config_ids[0].pricelist_id.id, display_default_code=False).read(self.get_fields())
        self.cache = cPickle.dumps(res, protocol=cPickle.HIGHEST_PROTOCOL)
        self.cachetime = datetime.now()
        
    @api.model
    def get_domain(self):
        return [('sale_ok', '=', True), ('available_in_pos', '=', True)]

    @api.model
    def get_fields(self):
        return ['display_name', 'list_price','price','pos_categ_id', 'taxes_id', 'ean13', 'default_code', 
                 'to_weight', 'uom_id', 'uos_id', 'uos_coeff', 'mes_type', 'description_sale', 'description',
                 'product_tmpl_id']


class pos_config(models.Model):
    _inherit = 'pos.config'

    #Use a related model to avoid the load of the cache when pos load config
    cache_id = fields.Many2one('pos.cache', 'Cache')

    @api.multi
    def getProductsFromCache(self):
        if not self.cache_id or not self.cache_id.cachetime:
            if not self.cache_id:
                self.cache_id = self.cache_id.create({})
            self.cache_id.refresh_cache()
        return cPickle.loads(self.cache_id.cache)
