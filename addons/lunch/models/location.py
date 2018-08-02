from odoo import models, api, fields, _
from functools import reduce

class Location(models.Model):
    _inherit = 'res.partner'

    ## Basic fields
    is_work_location = fields.Boolean(string='Is work location', default=False)
    ## Relational fields
    company_id = fields.Many2one(comodel_name='res.company', string='Company', required=True)
    user_ids = fields.One2many(comodel_name='res.users', inverse_name='location_id', string='Users')
    supplier_ids = fields.Many2many(comodel_name='lunch.supplier', string='Suppliers for this location')
    ## Computed fields
    product_ids = fields.Many2many(comodel_name='lunch.product', string='Possible products in this location', compute='_compute_product_ids')
    user_ids_possible = fields.Many2many(comodel_name='res.users', string='Users who can be assigned in this location', compute='_compute_user_ids_possible')

    ###################
    # Compute Methods #
    ###################
    @api.depends('supplier_ids')
    def _compute_product_ids(self):
        for record in self:
            record.product_ids = reduce(lambda acc, a: acc | a.product_ids, record.supplier_ids, self.env.get('lunch.product'))

    @api.depends('company_id')
    def _compute_user_ids_possible(self):
        for record in self:
            record.user_ids_possible = self.env.get('res.users').search([('company_id.id', '=', record.company_id.id)]).filtered(lambda user: not user.location_id)