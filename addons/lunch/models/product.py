from odoo import models, fields, api
from odoo.addons import decimal_precision as dp

class Product(models.Model):
    _name = 'lunch.product'

    ## Basic fields
    name = fields.Char(string='Product Name', required=True)
    description = fields.Text(string='Description')
    price = fields.Float(string='Price', digits=dp.get_precision('Account'))
    is_available = fields.Boolean(string='Is available', default=True)
    ## Relational fields
    category_id = fields.Many2one(comodel_name='lunch.product.category', string='Category')
    supplier_id = fields.Many2one(comodel_name='lunch.supplier', string='Supplier')
    ## Related fields
    location_ids = fields.Many2many(comodel_name='res.partner', string='Available in these locations', related='supplier_id.location_ids')
    ## Computed fields

    ###################
    # Compute Methods #
    ###################
