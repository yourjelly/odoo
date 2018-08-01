from odoo import models, api, fields, _

class Location(models.Model):
    _inherit = 'res.partner'

    is_work_location = fields.Boolean(string='Is work location', default=True)
    company_id = fields.Many2one(comodel_name='res.company', string='Company')
    user_ids = fields.One2many(comodel_name='res.users', inverse_name='location_id', string='Users')
    supplier_ids = fields.Many2many(comodel_name='lunch.supplier', string='Can buy from these vendors')