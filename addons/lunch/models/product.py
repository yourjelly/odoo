from odoo import models, fields, api
from odoo.addons import decimal_precision as dp

class Product(models.Model):
    _name = 'lunch.product'

    name = fields.Char(string='Product Name', required=True)
    description = fields.Text(string='Description')
    price = fields.Float(string='Price', digits=dp.get_precision('Account'))
    is_available = fields.Boolean(string='Is available', default=True)
    category_id = fields.Many2one(comodel_name='lunch.product.category', string='Category')
    supplier_id = fields.Many2one(comodel_name='lunch.supplier', string='Supplier')
