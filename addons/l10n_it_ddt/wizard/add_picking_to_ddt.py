# -*- coding: utf-8 -*-

from odoo import fields, models, api


class L10nItAddPickingsToDdt(models.TransientModel):
    _name = "l10n.it.ddt.add.pickings"

    ddt_id = fields.Many2one('l10n.it.ddt', string="DDT")

    @api.multi
    def do_print_ddt(self):
        self.ensure_one()
        pickings = self.env['stock.picking'].browse(
            self.env.context['active_ids'])
        pickings.l10n_it_ddt_id = self.ddt_id.id
        self.ddt_id._check_linked_picking(pickings)

        return {
            'name': 'DdT',
            'view_type': 'form',
            'view_mode': 'form',
            'res_model': 'l10n.it.ddt',
            'res_id': self.ddt_id.id,
            'type': 'ir.actions.act_window',
        }
