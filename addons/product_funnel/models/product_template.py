from odoo import models, fields


class ChartData(models.Model):
    _inherit = 'product.template'

    location_name = fields.Many2one('res.city')

    _sql_constraints = [(
        'product_unique',
        'unique(location_name,name)',
        'Location and Product name already exists!!')]
