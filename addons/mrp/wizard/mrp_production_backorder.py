# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import math
import re

from odoo import api, fields, models, _
from odoo.tools import float_is_zero

SIZE_BACK_ORDER_NUMERING = 3


class MrpProductionBackorderLine(models.TransientModel):
    _name = 'mrp.production.backorder.line'
    _description = "Backorder Confirmation Line"

    mrp_production_backorder_id = fields.Many2one('mrp.production.backorder', 'MO Backorder', required=True, ondelete="cascade")
    mrp_production_id = fields.Many2one('mrp.production', 'Manufacturing Order', required=True, ondelete="cascade", readonly=True)
    to_backorder = fields.Boolean('To Backorder')


class MrpProductionBackorder(models.TransientModel):
    _name = 'mrp.production.backorder'
    _description = "Wizard to mark as done or create back order"

    mrp_production_ids = fields.Many2many('mrp.production')

    mrp_production_backorder_line_ids = fields.One2many(
        'mrp.production.backorder.line',
        'mrp_production_backorder_id',
        string="Backorder Confirmation Lines")
    show_backorder_lines = fields.Boolean("Show backorder lines", compute="_compute_show_backorder_lines")

    @api.depends('mrp_production_backorder_line_ids')
    def _compute_show_backorder_lines(self):
        for wizard in self:
            wizard.show_backorder_lines = len(wizard.mrp_production_backorder_line_ids) > 1

    @api.model
    def _get_name_backorder(self, name, sequence):
        if not sequence:
            return name
        seq_back = "-" + "0" * (SIZE_BACK_ORDER_NUMERING - 1 - int(math.log10(sequence))) + str(sequence)
        if re.search("-\\d{%d}$" % SIZE_BACK_ORDER_NUMERING, name):
            return name[:-SIZE_BACK_ORDER_NUMERING-1] + seq_back
        return name + seq_back

    def _get_backorder_mo_vals(self, mo_source):
        next_seq = max(mo_source.procurement_group_id.mrp_production_ids.mapped("backorder_sequence"))
        return {
            'name': self._get_name_backorder(mo_source.name, next_seq + 1),
            'backorder_sequence': next_seq + 1,
            'procurement_group_id': mo_source.procurement_group_id.id,
            'move_raw_ids': None,
            'move_finished_ids': None,
            'product_qty': mo_source._get_quantity_to_backorder(),
            'lot_producing_id': False,
        }

    def _generate_backorder_productions(self):
        backorders = self.env['mrp.production']
        for production in self.mrp_production_backorder_line_ids.filtered(lambda l: l.to_backorder).mrp_production_id:
            if production.backorder_sequence == 0:  # Activate backorder naming
                production.backorder_sequence = 1
            for wo in production.workorder_ids:
                if wo.state in ('done', 'cancel'):
                    continue
                wo.button_finish()

            backorder_mo = production.copy(default=self._get_backorder_mo_vals(production))

            production.move_raw_ids.filtered(lambda m: m.state not in ('done', 'cancel')).write({
                'raw_material_production_id': backorder_mo.id,
                'reference': backorder_mo.name,
            })
            backorders |= backorder_mo

            production.name = self._get_name_backorder(production.name, production.backorder_sequence)
            # update moves references
            (production.move_raw_ids | production.move_finished_ids).reference = production.name

            for wo in backorder_mo.workorder_ids:
                wo.duration_expected = wo._get_duration_expected(wo.workcenter_id)

        self.mrp_production_ids._button_mark_done()
        backorders.action_confirm()
        # Remove the serial move line without reserved quantity. Post inventory will assigned all the non done moves
        # So those move lines are duplicated.
        backorders.move_raw_ids.move_line_ids.filtered(lambda ml: ml.product_id.tracking == 'serial' and ml.product_qty == 0).unlink()
        backorders.move_raw_ids._recompute_state()

        return backorders

    def action_close_mo(self):
        self.mrp_production_ids._post_inventory()
        for wo in self.mrp_production_ids.workorder_ids:
            if wo.state in ('done', 'cancel'):
                continue
            wo.button_finish()
        return self.mrp_production_ids._button_mark_done()

    def action_backorder(self):
        self.mrp_production_ids._post_inventory()
        backorders = self._generate_backorder_productions()
        action = {
            'res_model': 'mrp.production',
            'type': 'ir.actions.act_window',
        }
        if len(backorders) == 1:
            action.update({
                'view_mode': 'form',
                'res_id': backorders[0].id,
            })
        else:
            action.update({
                'name': _("Backorder MO"),
                'domain': [('id', 'in', backorders.ids)],
                'view_mode': 'tree,form',
            })
        return action
