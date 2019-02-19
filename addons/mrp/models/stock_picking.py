# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _
from odoo.exceptions import UserError

class StockPickingType(models.Model):
    _inherit = 'stock.picking.type'

    code = fields.Selection(selection_add=[('mrp_operation', 'Manufacturing Operation')])
    count_mo_todo = fields.Integer(string="Number of Manufacturing Orders to Process",
        compute='_get_mo_count')
    count_mo_waiting = fields.Integer(string="Number of Manufacturing Orders Waiting",
        compute='_get_mo_count')
    count_mo_late = fields.Integer(string="Number of Manufacturing Orders Late",
        compute='_get_mo_count')

    def _get_mo_count(self):
        mrp_picking_types = self.filtered(lambda picking: picking.code == 'mrp_operation')
        if not mrp_picking_types:
            return
        domains = {
            'count_mo_waiting': [('reservation_state', '=', 'waiting')],
            'count_mo_todo': ['|', ('state', 'in', ('confirmed', 'draft', 'planned', 'progress'))],
            'count_mo_late': [('date_planned_start', '<', fields.Date.today()), ('state', '=', 'confirmed')],
        }
        for field in domains:
            data = self.env['mrp.production'].read_group(domains[field] +
                [('state', 'not in', ('done', 'cancel')), ('picking_type_id', 'in', self.ids)],
                ['picking_type_id'], ['picking_type_id'])
            count = {x['picking_type_id'] and x['picking_type_id'][0]: x['picking_type_id_count'] for x in data}
            for record in mrp_picking_types:
                record[field] = count.get(record.id, 0)

    def get_mrp_stock_picking_action_picking_type(self):
        return self._get_action('mrp.mrp_production_action_picking_deshboard')

class StockPicking(models.Model):
    _inherit = 'stock.picking'

    def action_confirm(self):
        for picking in self:
            if picking.partner_id.type == 'subcontractor' and picking.picking_type_id.code == 'incoming':
                subcontract_details = []
                for m in picking.move_lines:
                    product = m.product_id
                    params = {'partner_type': 'subcontractor'}
                    seller = m.product_id._select_seller(
                        partner_id=picking.partner_id,
                        quantity=m.product_qty,
                        date=picking.scheduled_date and picking.scheduled_date.date(),
                        uom_id=m.product_uom,
                        params=params)
                    if not seller.bom_subcontract:
                        raise UserError(_("You can't subcontract the product %s if there is no BoM of type subcontract associated to it") % product.name)
                    subcontract_details.append((seller, m.product_id, m.product_qty))
                picking._subcontracted_produce(subcontract_details)
        super(StockPicking, self).action_confirm()

    def _subcontracted_produce(self, subcontract_details):
        for subcontractor, product, qty in subcontract_details:
            mo = self.env['mrp.production'].create({
                'product_id': product.id,
                'product_uom_id': product.uom_id.id,
                'bom_id': subcontractor.bom_subcontract.id,
                'location_src_id': subcontractor.name.property_stock_supplier.id,
                'location_dest_id': subcontractor.name.property_stock_supplier.id,
                'product_qty': qty,
            })
            self.env['stock.move'].create(mo._get_moves_raw_values())
            mo.action_confirm()
            mo.action_assign()
            #mo.move_finished_id.quantity_done = mo.move_finished_id.product_uom_qty
            #mo.move_finished_id._action_done()

    def _less_quantities_than_expected_add_documents(self, moves, documents):
        documents = super(StockPicking, self)._less_quantities_than_expected_add_documents(moves, documents)

        def _keys_in_sorted(move):
            """ sort by picking and the responsible for the product the
            move.
            """
            return (move.raw_material_production_id.id, move.product_id.responsible_id.id)

        def _keys_in_groupby(move):
            """ group by picking and the responsible for the product the
            move.
            """
            return (move.raw_material_production_id, move.product_id.responsible_id)

        production_documents = self._log_activity_get_documents(moves, 'move_dest_ids', 'DOWN', _keys_in_sorted, _keys_in_groupby)
        return {**documents, **production_documents}
