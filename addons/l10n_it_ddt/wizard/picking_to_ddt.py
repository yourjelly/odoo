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
        self._check_ddt_values()
        self.picking_ids.write({'ddt_id': self.ddt_id.id})
        return True

    def _check_ddt_values(self):
        partner_id = self.picking_ids.mapped('partner_id')
        warehouse_id = self.picking_ids.mapped('warehouse_id')
        picking_types = self.picking_ids.mapped('picking_type_id')
        if len(partner_id) > 1 or self.ddt_id and partner_id.id != self.ddt_id.partner_id:
            raise UserError(_('DDT partner must be same to link picking.'))
        if len(warehouse_id) > 1 or self.ddt_id and warehouse_id.id != self.ddt_id.warehouse_id:
            raise UserError(_('DDT warehouse must be same to link picking.'))
        if len(picking_types) > 1 or self.ddt_id and picking_types.id != self.ddt_id.picking_types:
            raise UserError(_('DDT picking type must be same to link picking.'))

    def _prepare_ddt_values(self):
        partner_id = self.picking_ids.mapped('partner_id')
        warehouse_id = self.picking_ids.mapped('warehouse_id')
        company_id = self.pickings_ids.mapped('company_id')
        return {
            'partner_id': partner_id,
            'warehouse_id': warehouse_id,
            'company_id': company_id
        }

    @api.multi
    def create_ddt(self):
        self._check_ddt_values()
        values = self._prepare_ddt_values()
        ddt_id = self.ddt_id.create(values)
        return {
            'name': 'DDT',
            'view_type': 'form',
            'view_mode': 'form',
            'res_model': 'l10n.it.ddt',
            'res_id': ddt_id.id,
            'type': 'ir.actions.act_window',
        }
