from odoo import models, fields, api, _


class User(models.Model):
    _inherit = 'res.users'

    ## Relational fields
    location_id = fields.Many2one(comodel_name='res.partner', string='Work Location')
    ## Related fields
    ## Computed fields

    @api.onchange('company_id')
    def _onchange_company_id(self):
        self.ensure_one()
        location_ids_possible = self.env.get('res.partner').search([('is_work_location', '=', True)]).filtered(lambda location: location.company_id.id == self.company_id.id)
        return {
            'domain': {
                'location_id': [('id', 'in', location_ids_possible.ids)]
            }
        }
