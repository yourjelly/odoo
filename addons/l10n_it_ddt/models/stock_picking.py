# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import Warning as UserError


class StockPicking(models.Model):
    _inherit = "stock.picking"

    l10n_it_ddt_id = fields.Many2one('l10n.it.ddt', String='DDT')

    def _check_multi_picking(self):
        if len(self.mapped('picking_type_id')) > 1:
            raise UserError(
                    _("Selected Pickings have diffrent Operation Type"))
        if len(self.mapped('partner_id')) > 1:
                raise UserError(
                    _("Selected Pickings have different Partners"))
        for picking in self:
            if picking.l10n_it_ddt_id:
                raise UserError(
                    _("Picking %s already in ddt %s") %
                     (picking.name, picking.l10n_it_ddt_id.name))


class StockMove(models.Model):
    _inherit = "stock.move"

    l10n_it_ddt_id = fields.Many2one('l10n.it.ddt', String='DDT')

    @api.multi
    def _pripare_ddt_line(self):
        self.ensure_one()
        return {
                'product_id': self.product_id.id,
                'quantity': self.product_uom_qty,
                'product_uom_id': self.product_uom.id,
                'unit_price': self.sale_line_id and self.sale_line_id.price_unit or 0,
                'discount': self.sale_line_id and self.sale_line_id.discount or 0,
                'tax_ids': [(6, 0, self.sale_line_id.tax_id.ids)],
                'name': self.name,
                'move_line_id': self.id,
            }
