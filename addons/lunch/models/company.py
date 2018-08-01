from odoo import fields, models, api, _


class Company(models.Model):
    _inherit = 'res.company'

    location_ids = fields.One2many(comodel_name='res.partner', inverse_name='company_id', string='Work Locations', domain=[('is_work_location', '=', True)])