from odoo import models, fields, api, _


class User(models.Model):
    _inherit = 'res.users'

    location_id = fields.Many2one(comodel_name='res.partner', string='Work Location', domain=[('is_work_location', '=', True)])