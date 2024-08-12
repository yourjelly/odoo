# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models, Command
from odoo.tools import float_round, float_compare
from odoo.exceptions import UserError


class MrpProductionSplitMulti(models.TransientModel):
    _name = 'mrp.production.split.multi'
    _description = "Wizard to Split Multiple Productions"

    production_ids = fields.One2many('mrp.production.split', 'production_split_multi_id', 'Productions To Split')


class MrpProductionSplit(models.TransientModel):
    _name = 'mrp.production.split'
    _description = "Wizard to Split a Production"

    production_split_multi_id = fields.Many2one('mrp.production.split.multi', 'Split Productions')
    production_id = fields.Many2one('mrp.production', 'Manufacturing Order', readonly=True)
    product_id = fields.Many2one(related='production_id.product_id')
    product_qty = fields.Float(related='production_id.product_qty')
    product_uom_id = fields.Many2one(related='production_id.product_uom_id')
    production_capacity = fields.Float(related='production_id.production_capacity')
    counter = fields.Integer(
        "Split #", default=2, compute="_compute_counter",
        store=True, readonly=False)
    production_detailed_vals_ids = fields.One2many(
        'mrp.production.split.line', 'mrp_production_split_id',
        'Split Details', compute="_compute_details", store=True, readonly=False)
    valid_details = fields.Boolean("Valid", compute="_compute_valid_details")
    split_pre_production_picking = fields.Boolean("Split Pre Production Picking", default=True, help="When ticked, pre-production picking is split for each MO that generate.")

    @api.depends('production_detailed_vals_ids')
    def _compute_counter(self):
        for wizard in self:
            wizard.counter = len(wizard.production_detailed_vals_ids)

    @api.depends('counter')
    def _compute_details(self):
        for wizard in self:
            commands = [Command.clear()]
            if wizard.counter < 1 or not wizard.production_id:
                wizard.production_detailed_vals_ids = commands
                continue
            quantity = float_round(wizard.product_qty / wizard.counter, precision_rounding=wizard.product_uom_id.rounding)
            remaining_quantity = wizard.product_qty
            for i in range(wizard.counter - 1):
                commands.append(Command.create({
                    'quantity': quantity,
                    'user_id': wizard.production_id.user_id,
                    'date': wizard.production_id.date_start,
                }))
                remaining_quantity = float_round(remaining_quantity - quantity, precision_rounding=wizard.product_uom_id.rounding)
            commands.append(Command.create({
                'quantity': remaining_quantity,
                'user_id': wizard.production_id.user_id,
                'date': wizard.production_id.date_start,
            }))
            wizard.production_detailed_vals_ids = commands

    @api.depends('production_detailed_vals_ids')
    def _compute_valid_details(self):
        self.valid_details = False
        for wizard in self:
            if wizard.production_detailed_vals_ids:
                wizard.valid_details = float_compare(wizard.product_qty, sum(wizard.production_detailed_vals_ids.mapped('quantity')), precision_rounding=wizard.product_uom_id.rounding) == 0

    def action_split(self):
        if self.split_pre_production_picking:
            filtered_picking_ids = self.production_id.picking_ids.filtered(
                        lambda picking: picking.origin == self.production_id.name or
                        any(
                            self.production_id in move.move_dest_ids.mapped('raw_material_production_id') or self.production_id.id == move.move_orig_ids.production_id.id
                            for move in picking.move_ids
                        )
                    )
            if filtered_picking_ids.state == "done":
                raise UserError(_("Can't split pre-production picking: picking is already done of manufacturing order"))
        productions = self.production_id._split_productions({self.production_id: [detail.quantity for detail in self.production_detailed_vals_ids]})
        for production, detail in zip(productions, self.production_detailed_vals_ids):
            production.user_id = detail.user_id
            production.date_start = detail.date
        # split the pre-production picking if split_pre_production_picking set to true
        if self.split_pre_production_picking and self.production_id.warehouse_id.manufacture_steps == 'pbm_sam':
            filtered_picking_ids.action_cancel()
            for production in productions:
                production.move_raw_ids.write({'state': 'draft'})
                production.write({'state': 'draft'})
                production.action_confirm()

        if self.production_split_multi_id:
            saved_production_split_multi_id = self.production_split_multi_id.id
            self.production_split_multi_id.production_ids = [Command.unlink(self.id)]
            action = self.env['ir.actions.actions']._for_xml_id('mrp.action_mrp_production_split_multi')
            action['res_id'] = saved_production_split_multi_id
            return action

    def action_prepare_split(self):
        action = self.env['ir.actions.actions']._for_xml_id('mrp.action_mrp_production_split')
        action['res_id'] = self.id
        return action

    def action_return_to_list(self):
        self.production_detailed_vals_ids = [Command.clear()]
        self.counter = 0
        action = self.env['ir.actions.actions']._for_xml_id('mrp.action_mrp_production_split_multi')
        action['res_id'] = self.production_split_multi_id.id
        return action


class MrpProductionSplitLine(models.TransientModel):
    _name = 'mrp.production.split.line'
    _description = "Split Production Detail"

    mrp_production_split_id = fields.Many2one(
        'mrp.production.split', 'Split Production', required=True, ondelete="cascade")
    quantity = fields.Float('Quantity To Produce', digits='Product Unit of Measure', required=True)
    user_id = fields.Many2one(
        'res.users', 'Responsible',
        domain=lambda self: [('groups_id', 'in', self.env.ref('mrp.group_mrp_user').id)])
    date = fields.Datetime('Schedule Date')
