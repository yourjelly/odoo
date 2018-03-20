# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class RemovalStrategy(models.Model):
    _name = 'product.removal'
    _description = 'Removal Strategy'

    name = fields.Char('Name', required=True)
    method = fields.Char("Method", required=True, help="FIFO, LIFO...")


class PutAwayStrategy(models.Model):
    _name = 'product.putaway'
    _description = 'Put Away Strategy'

    name = fields.Char('Name', required=True)
    based_on = fields.Selection([
        ('category', 'Product Category'),
        ('product', 'Product'),
        ('product_category', 'Product Category & Product'),
    ], default='category', required=True)

    putaway_category_location_ids = fields.One2many(
        'stock.fixed.putaway.strat', 'putaway_id',
        'Putaway Locations Per Product Category', domain=[('category_id', '!=', False)])
    putaway_product_location_ids = fields.One2many(
        'stock.fixed.putaway.strat', 'putaway_id',
        'Putaway Locations Per Product', domain=[('product_id', '!=', False)])

    def putaway_apply(self, product):
        if self.putaway_product_location_ids:
            put_away = self.putaway_product_location_ids.filtered(lambda x: x.product_id == product)
            if put_away:
                return put_away[0].putaway_location_id
        elif self.putaway_category_location_ids:
            categ = product.categ_id
            while categ:
                put_away = self.putaway_category_location_ids.filtered(lambda x: x.category_id == categ)
                if put_away:
                    return put_away[0].putaway_location_id
                categ = categ.parent_id
        return self.env['stock.location']


class FixedPutAwayStrategy(models.Model):
    _name = 'stock.fixed.putaway.strat'
    _order = 'sequence'

    product_id = fields.Many2one('product.product', 'Product')
    putaway_id = fields.Many2one('product.putaway', 'Put Away Method', required=True)
    category_id = fields.Many2one('product.category', 'Product Category')
    putaway_location_id = fields.Many2one('stock.location', 'Location', required=True)
    sequence = fields.Integer('Priority', help="Give to the more specialized category, a higher priority to have them in top of the list.")
