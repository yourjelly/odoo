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

from openerp import models, fields, api


class pos_cache(models.Model):
    _name = 'pos.cache'

    name = fields.Datetime(string="Last cache invalidation")

    @api.model
    def invalidate(self):
        new = self.create({'name': datetime.now()})
        olds = self.search([('id', '<', new.id)])
        if olds:
            olds.unlink()
        return new


class product_product(models.Model):
    _inherit = 'product.product'

    @api.multi
    def unlink(self):
        self.env['pos.cache'].invalidate()
        return super(product_product, self).unlink()


class product_template(models.Model):
    _inherit = 'product.template'

    @api.multi
    def unlink(self):
        self.env['pos.cache'].invalidate()
        return super(product_template, self).unlink()
