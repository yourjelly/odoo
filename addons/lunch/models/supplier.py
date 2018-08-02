from odoo import models, api, fields, _
from functools import reduce

class Supplier(models.Model):
    _name = 'lunch.supplier'

    ## Basic fields
    name = fields.Char(string='Supplier Name', required=True)
    address = fields.Char(string='Address')
    email_address = fields.Char(string='Email Address')
    phone_number = fields.Char(string='Phone Number')
    description = fields.Text(string='Description')
    ## Relational fields
    product_ids = fields.One2many(comodel_name='lunch.product', inverse_name='supplier_id', string='Products')
    location_ids = fields.Many2many(comodel_name='res.partner', string='Sells to these locations', domain=[('is_work_location', '=', True)])
    ## Computed fields
    category_ids = fields.Many2many(comodel_name='lunch.product.category', string='Categories in this supplier', compute='_compute_category_ids')

    ###################
    # Compute Methods #
    ###################
    @api.depends('product_ids')
    def _compute_category_ids(self):
        for record in self:
            empty_category_ids = self.env.get('lunch.product.category')
            record.category_ids = reduce(lambda acc, a: acc | a.category_id, record.product_ids, empty_category_ids)