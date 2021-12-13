from odoo import api, fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    
    tr_tax_office = fields.Many2one(comodel_name='tr.tax.office')
