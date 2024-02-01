# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging
from odoo import fields, models

_logger = logging.getLogger(__name__)

class PosTerminal(models.Model):
    _name = "pos.terminal"
    _description = "Mercado Pago 'Point Smart' terminals"
    _rec_name = 'id_point_smart'

    id_point_smart = fields.Char(string="Terminal S/N", required=True, readonly=True)
    point_smart_op_mode = fields.Selection([('STANDALONE', 'Standalone'), ('PDV', 'Point of sale')], required=True)
    id_point_smart_store = fields.Char(string="Terminal Store id", required=False, readonly=True)
    id_point_smart_pos = fields.Char(string="Terminal POS id", required=False, readonly=True)
    point_smart_store = fields.Text(string="Store", required=False, readonly=True)
    point_smart_pos = fields.Text(string="POS", required=False, readonly=True)

    def name_get(self):
        result = []
        for record in self:
            result.append((record.id, f"{record.id_point_smart}"))
        return result
