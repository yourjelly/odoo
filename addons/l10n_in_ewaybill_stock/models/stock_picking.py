# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class StockPicking(models.Model):
    _inherit = "stock.picking"

    ewaybill_ids = fields.One2many(
        comodel_name='l10n.in.ewaybill',
        inverse_name='stock_picking_id',
    )

    def action_open_ewaybill_form(self):
        self.ensure_one()

        return{
            'name': "Ewaybill",
            'res_model': 'l10n.in.ewaybill',
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'view_id': self.env.ref('l10n_in_ewaybill_stock.l10n_in_ewaybill_form_view').id,
            'context': {
                'default_stock_picking_id': self.id,
            }
        }

    def action_open_ewaybills(self):
        self.ensure_one()

        return {
            'name': 'Ewaybills',
            'res_model': 'l10n.in.ewaybill',
            'type': 'ir.actions.act_window',
            'view_mode': 'tree,form',
            'views': [(self.env.ref('l10n_in_ewaybill_stock.l10n_in_ewaybill_tree_view').id, 'tree'),
                      (self.env.ref('l10n_in_ewaybill_stock.l10n_in_ewaybill_form_view').id, 'form')],
            'domain': [('id', 'in', self.ewaybill_ids.ids)],
            'target': 'current',
        }
