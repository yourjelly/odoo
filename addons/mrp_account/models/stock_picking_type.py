#  Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models, fields


class PickingType(models.Model):
    _name = "stock.picking.type"
    _inherit = "stock.picking.type"

    production_wip_location = fields.Many2one('stock.location', "WIP Location")
