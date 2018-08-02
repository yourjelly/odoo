from odoo import fields, models, api, _


class Company(models.Model):
    _inherit = 'res.company'

    ## Relational fields
    location_ids = fields.One2many(comodel_name='res.partner', inverse_name='company_id', string='Work Locations', readonly=True, domain=[('is_work_location', '=', True)])
    ## Computed fields
