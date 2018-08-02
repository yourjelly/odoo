from odoo import models, fields, api, _
from functools import reduce

class ProductCategory(models.Model):
    _name = 'lunch.product.category'

    ## Basic fields
    name = fields.Char('Product Category', required=True)
    ## Relational fields
    product_ids = fields.One2many(comodel_name='lunch.product', inverse_name='category_id', string='Products with this category')
    ## Computed fields
    supplier_ids = fields.Many2many(comodel_name='lunch.supplier', string='Suppliers having this category', compute='_compute_supplier_ids')
    product_ids_without_category = fields.Many2many(comodel_name='lunch.product', string='Uncategorized products', compute='_compute_product_ids_without_category')

    ###################
    # Compute Methods #
    ###################
    @api.depends('product_ids')
    def _compute_supplier_ids(self):
        for record in self:
            empty_supplier_ids = self.env.get('lunch.supplier')
            record.supplier_ids = reduce(lambda acc, a: acc | a.supplier_id, record.product_ids, empty_supplier_ids)

    @api.depends('product_ids')
    def _compute_product_ids_without_category(self):
        # DESCRIPTION: This is calculated to add domain in the `product_ids` field. The additional domain is to show only the uncategorized products.

        def is_without_category(product):
            # NOTE: This doesn't work as intended when delete is performed, but it is sufficient.
            return not product.category_id

        for record in self:
            all_products = self.env.get('lunch.product').search([])
            record.product_ids_without_category = all_products.filtered(is_without_category)
