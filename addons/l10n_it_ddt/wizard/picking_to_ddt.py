# -*- coding: utf-8 -*-

from odoo import fields, models, api


class L10nItAddPickingsToDdt(models.TransientModel):
    _name = "l10n.it.ddt.to.pickings"

    def _get_picking_ids(self):
        return self.env['stock.picking'].browse(self.env.context['active_ids'])


    ddt_id = fields.Many2one('l10n.it.ddt', string="DDT")
    picking_ids = fields.Many2many('stock.picking', string="DDT", default=_get_picking_ids)

    @api.multi
    def add_ddt(self):
        self.ensure_one()
        pickings = self.env['stock.picking'].browse(
            self.env.context['active_ids'])
        self.ddt_id._check_linked_picking(pickings)
        pickings._check_multi_picking()
        pickings.l10n_it_ddt_id = self.ddt_id.id
        return {
            'name': 'DDT',
            'view_type': 'form',
            'view_mode': 'form',
            'res_model': 'l10n.it.ddt',
            'res_id': self.ddt_id.id,
            'type': 'ir.actions.act_window',
        }

    @api.multi
    def create_ddt(self):
        self.ensure_one()
        print(self.picking_ids)
        ddt_id = self.picking_ids.create_ddt()
        return {
            'name': 'DdT',
            'view_type': 'form',
            'view_mode': 'form',
            'res_model': 'l10n.it.ddt',
            'res_id': ddt_id.id,
            'type': 'ir.actions.act_window',
        }
