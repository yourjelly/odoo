from odoo import models, fields, api, _

class ProductCategory(models.Model):
    _name = 'lunch.product.category'

    name = fields.Char('Product Category', required=True)
    product_ids = fields.One2many(comodel_name='lunch.product', inverse_name='category_id', string='Products with this category')