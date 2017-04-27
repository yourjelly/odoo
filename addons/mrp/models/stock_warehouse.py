# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, exceptions, fields, models, _


class StockWarehouse(models.Model):
    _inherit = 'stock.warehouse'

    manufacture_to_resupply = fields.Boolean(
        'Manufacture in this Warehouse', default=True,
        help="When products are manufactured, they can be manufactured in this warehouse.")
    manufacture_pull_id = fields.Many2one(
        'procurement.rule', 'Manufacture Rule')
    manu_type_id = fields.Many2one(
        'stock.picking.type', 'Manufacturing Operation Type',
        domain=[('code', '=', 'mrp_operation')])
    manufacture_steps = fields.Selection([
        ('manu_only', 'Manufacture: stock -> manufacture -> stock (step 1)'),
        ('pick_manu', 'Manufacture: stock -> input -> manufacture -> stock (step 2)'),
        ('pick_manu_out', 'Manufacture: stock -> input -> manufacture -> output -> stock (step 3)')],
        'Manufacture', default='manu_only', required=True,
        help="Default manufacture route to follow")
    wh_input_manu_loc_id = fields.Many2one("stock.location", "Input Manufacture Location")
    wh_output_manu_loc_id = fields.Many2one("stock.location", "Output Manufacture Location")
    multistep_manu_route_id = fields.Many2one('stock.location.route', 'Multistep Manufacturing Route', ondelete='restrict')

    def create_sequences_and_picking_types(self):
        res = super(StockWarehouse, self).create_sequences_and_picking_types()
        self._create_manufacturing_picking_type()
        return res

    @api.multi
    def get_routes_dict(self):
        result = super(StockWarehouse, self).get_routes_dict()
        production_location = self.env['ir.model.data'].sudo().get_object('stock', 'location_production')
        for warehouse in self:
            result[warehouse.id]['manu_only'] = [
                self.Routing(warehouse.lot_stock_id, warehouse.lot_stock_id, warehouse.int_type_id)]
            result[warehouse.id]['pick_manu'] = [
                self.Routing(warehouse.lot_stock_id, warehouse.wh_input_manu_loc_id, warehouse.int_type_id),
                self.Routing(warehouse.wh_input_manu_loc_id, production_location, warehouse.int_type_id)]
            result[warehouse.id]['pick_manu_out'] = [
                self.Routing(warehouse.lot_stock_id, warehouse.wh_input_manu_loc_id, warehouse.int_type_id),
                self.Routing(warehouse.wh_input_manu_loc_id, production_location, warehouse.int_type_id),
                self.Routing(production_location, warehouse.wh_output_manu_loc_id, warehouse.int_type_id)]
            result[warehouse.id]['manufacture'] = [
                self.Routing(warehouse.wh_output_manu_loc_id, warehouse.lot_stock_id, warehouse.int_type_id)]
            result[warehouse.id]['manufacture_push'] = [
                self.Routing(warehouse.lot_stock_id, warehouse.wh_output_manu_loc_id, warehouse.int_type_id)]
        return result

    def _get_manufacture_route_id(self):
        manufacture_route_id = self.env.ref('mrp.route_warehouse0_manufacture').id
        if not manufacture_route_id:
            manufacture_route_id = self.env['stock.location.route'].search([('name', 'like', _('Manufacture'))], limit=1).id
        if not manufacture_route_id:
            raise exceptions.UserError(_('Can\'t find any generic Manufacture route.'))
        return manufacture_route_id

    def _get_manufacture_pull_rules_values(self, route_values):
        if not self.manu_type_id:
            self._create_manufacturing_picking_type()
        dummy, pull_rules_list = self._get_push_pull_rules_values(route_values, pull_values={
            'name': self._format_routename(_(' Manufacture')),
            'location_src_id': False,  # TDE FIXME
            'action': 'manufacture',
            'route_id': self._get_manufacture_route_id(),
            'picking_type_id': self.manu_type_id.id,
            'propagate': False,
            'active': True})
        return pull_rules_list

    def _get_manufacture_push_rules_values(self, route_values):
        if not self.manu_type_id:
            self._create_manufacturing_picking_type()
        dummy, push_rules_list = self._get_push_pull_rules_values(route_values[self.id]['manufacture_push'], push_values={
                'name': self._format_routename(_(' Manufacture')),
                'location_from_id': False,
                'location_dest_id': False,
                'auto': 'manual',
                'picking_type_id': False,
                'warehouse_id': self.id})
        return push_rules_list

    def _create_manufacturing_picking_type(self):
        # TDE CLEANME
        picking_type_obj = self.env['stock.picking.type']
        seq_obj = self.env['ir.sequence']
        for warehouse in self:
            wh_stock_loc = warehouse.lot_stock_id
            seq = seq_obj.search([('code', '=', 'mrp.production')], limit=1)
            other_pick_type = picking_type_obj.search([('warehouse_id', '=', warehouse.id)], order = 'sequence desc', limit=1)
            color = other_pick_type and other_pick_type.color or 0
            max_sequence = other_pick_type and other_pick_type.sequence or 0
            manu_type = picking_type_obj.create({
                'name': _('Manufacturing'),
                'warehouse_id': warehouse.id,
                'code': 'mrp_operation',
                'use_create_lots': True,
                'use_existing_lots': False,
                'sequence_id': seq.id,
                'default_location_src_id': wh_stock_loc.id,
                'default_location_dest_id': wh_stock_loc.id,
                'sequence': max_sequence,
                'color': color})
            warehouse.write({'manu_type_id': manu_type.id})

    def _create_or_update_new_multistep_manufacturing_route(self, routes_data):
        routes_data = routes_data or self.get_routes_dict()
        for warehouse in self:
            if warehouse.multistep_manu_route_id:
                manufacturing_route = warehouse.multistep_manu_route_id
                manufacturing_route.write({'name':  warehouse._format_routename(route_type=warehouse.manufacture_steps)})
                manufacturing_route.pull_ids.write({'active': False})
                manufacturing_route.push_ids.write({'active': False})
            else:
                manufacturing_route = self.env['stock.location.route'].create(warehouse._get_manufacturing_route_values(warehouse.manufacture_steps))
                warehouse.multistep_manu_route_id = manufacturing_route.id
                manufacturing_route.company_id = warehouse.company_id.id
            # push / procurement (pull) rules for reception
            routings = routes_data[warehouse.id][warehouse.manufacture_steps]
            push_rules_list, pull_rules_list = warehouse._get_push_pull_rules_values(
                routings, values={'active': True, 'route_id': manufacturing_route.id},
                push_values=None, pull_values={'procure_method': 'make_to_order'})
            for pull_vals in pull_rules_list:
                existing_pull = self.env['procurement.rule'].search([
                    ('picking_type_id', '=', pull_vals['picking_type_id']),
                    ('location_src_id', '=', pull_vals['location_src_id']),
                    ('location_id', '=', pull_vals['location_id']),
                    ('route_id', '=', pull_vals['route_id']),
                    ('active', '=', False),
                ])
                if not existing_pull:
                    pull_vals['company_id'] = warehouse.company_id.id
                    pull_vals['procure_method'] = 'make_to_order'
                    self.env['procurement.rule'].create(pull_vals)
                else:
                    existing_pull.write({'active': True})
        return manufacturing_route

    def _create_or_update_manufacturing_route(self, routes_data):
        """ Delivery (MTS) route """
        routes_data = routes_data or self.get_routes_dict()
        for warehouse in self:
            if warehouse.wh_input_manu_loc_id:
                manufcture_route = self.env['stock.location.route'].search([('name', 'like', _('Manufacture'))], limit=1)
                manufcture_route.pull_ids.write({'active': False})
                manufcture_route.push_ids.write({'active': False})
            else:
                manufcture_route = self.env['stock.location.route'].create(warehouse._get_manufacturing_route_values(warehouse.manufacture_steps))
            routings = routes_data[warehouse.id]['manufacture']
            dummy, pull_rules_list = warehouse._get_push_pull_rules_values(
                routings, values={'active': True, 'procure_method': 'make_to_order', 'route_id': manufcture_route.id})
            if warehouse.manufacture_pull_id.route_id.push_ids:
                vals = warehouse._get_manufacture_push_rules_values(routes_data)[0]
                for push_id in warehouse.manufacture_pull_id.route_id.push_ids:
                    existing_push = self.env['stock.location.path'].search([
                        ('location_from_id', '=',  vals['location_id']),
                        ('location_dest_id', '=',  vals['location_src_id']),
                        ('picking_type_id', '=', vals['picking_type_id'])
                    ])
                    if existing_push:
                        existing_push.write({'active': True})
                        break
                    else:
                        self.env['stock.location.path'].create({
                            'name': vals['name'],
                            'location_from_id': vals['location_id'],
                            'location_dest_id': vals['location_src_id'],
                            'picking_type_id': vals['picking_type_id'],
                            'route_id': manufcture_route.id,
                            'company_id': warehouse.company_id.id
                            })
                        break
            else:
                vals = warehouse._get_manufacture_push_rules_values(routes_data)[0]
                self.env['stock.location.path'].create({
                    'name': vals['name'],
                    'location_from_id': vals['location_id'],
                    'location_dest_id': vals['location_src_id'],
                    'picking_type_id': vals['picking_type_id'],
                    'route_id': manufcture_route.id,
                    })
            for pull_vals in pull_rules_list:
                existing_pull = self.env['procurement.rule'].search([
                    ('picking_type_id', '=', pull_vals['picking_type_id']),
                    ('location_src_id', '=', pull_vals['location_src_id']),
                    ('location_id', '=', pull_vals['location_id']),
                    ('route_id', '=', pull_vals['route_id'] or manufcture_route.id),
                    ('active', '=', False),
                ])
                if not existing_pull:
                    pull_vals['company_id'] = warehouse.company_id.id
                    self.env['procurement.rule'].create(pull_vals)
                else:
                    existing_pull.write({'active': True})
        return manufcture_route

    @api.multi
    def _get_manufacturing_route_values(self, route_type):
        return {
            'name': self._format_routename(route_type=route_type),
            'product_categ_selectable': False,
            'product_selectable': True,
            'sequence': 10,
        }

    def _create_or_update_manufacture_pull(self, routes_data):
        routes_data = routes_data or self.get_routes_dict()
        for warehouse in self:
            routings = routes_data[warehouse.id][warehouse.manufacture_steps]
            if warehouse.manufacture_pull_id:
                manufacture_pull = warehouse.manufacture_pull_id
                manufacture_pull.write(warehouse._get_manufacture_pull_rules_values(routings)[0])
            else:
                manufacture_pull = self.env['procurement.rule'].create(warehouse._get_manufacture_pull_rules_values(routings)[0])
        return manufacture_pull

    @api.multi
    def create_routes(self):
        res = super(StockWarehouse, self).create_routes()
        self.ensure_one()
        routes_data = self.get_routes_dict()
        manufacture_route = self._create_or_update_manufacturing_route(routes_data)
        manufacture_pull = self._create_or_update_manufacture_pull(routes_data)
        nw_manu_route = self._create_or_update_new_multistep_manufacturing_route(routes_data)
        res['manufacture_pull_id'] = manufacture_pull.id
        return res

    def _get_route_name(self, route_type):
        names = {'one_step': _('Receipt in 1 step'), 'two_steps': _('Receipt in 2 steps'),
                 'three_steps': _('Receipt in 3 steps'), 'crossdock': _('Cross-Dock'),
                 'ship_only': _('Ship Only'), 'pick_ship': _('Pick + Ship'),
                 'pick_pack_ship': _('Pick + Pack + Ship'),
                 'manu_only': _('Manufacture: Stock -> Manufacture -> Stock'),
                 'pick_manu': ('Manufacture: Stock -> Input -> Manufacture -> Stock'),
                 'pick_manu_out': _('Manufacture: Stock -> Input -> Manufacture -> Output -> Stock')
                 }
        return names[route_type]

    @api.multi
    def _update_routes(self):
        res = super(StockWarehouse, self)._update_routes()
        self.ensure_one()
        routes_data = self.get_routes_dict()
        manufacture_route = self._create_or_update_manufacturing_route(routes_data)
        manufacture_pull = self._create_or_update_manufacture_pull(routes_data)
        nw_manu_route = self._create_or_update_new_multistep_manufacturing_route(routes_data)
        return res

    def _create_or_update_locations(self):
        StockLocation = self.env['stock.location'].with_context(active_test=False)
        for wh in self.filtered(lambda w: not w.wh_input_manu_loc_id or not w.wh_output_manu_loc_id):
            if not wh.wh_input_manu_loc_id:
                prod_in = StockLocation.search([('name', '=', 'PROD IN'), ('location_id', '=', wh.view_location_id.id), ('usage', '=', 'internal'), '|', ('company_id', '=', wh.company_id.id), ('company_id', '=', False)])
                if not prod_in:
                    prod_in = StockLocation.create({'name': 'PROD IN', 'location_id': wh.view_location_id.id, 'usage': 'internal', 'company_id': wh.company_id.id, 'active': True})
            if not wh.wh_output_manu_loc_id:
                prod_out = StockLocation.search([('name', '=', 'PROD OUT'), ('location_id', '=', wh.view_location_id.id), ('usage', '=', 'internal'), '|', ('company_id', '=', wh.company_id.id), ('company_id', '=', False)])
                if not prod_out:
                    prod_out = StockLocation.create({'name': 'PROD OUT', 'location_id': wh.view_location_id.id, 'usage': 'internal', 'company_id': wh.company_id.id, 'active': True})
            vals = {}
            if prod_in:
                vals['wh_input_manu_loc_id'] = prod_in.id
            if prod_out:
                vals['wh_output_manu_loc_id'] = prod_out.id
            if vals:
                wh.write(vals)

    def _update_existing_manufacture_route(self, manufacture_steps):
        routes_data = self.get_routes_dict()
        if manufacture_steps == 'pick_manu':
            self._create_or_update_manufacture_pull(routes_data)
            self.manufacture_pull_id.route_id.push_ids.write({'active': False})
            self.manufacture_pull_id.route_id.pull_ids.write({'active': False})
            return self.manufacture_pull_id.write({'location_id': self.lot_stock_id.id,
                                            'location_src_id': self.wh_input_manu_loc_id.id,
                                            'picking_type_id': self.manu_type_id.id,
                                            'active': True})
        if manufacture_steps == 'pick_manu_out':
            self._create_or_update_manufacture_pull(routes_data)
            self.manufacture_pull_id.route_id.push_ids.write({'active': True})
            self.manufacture_pull_id.route_id.pull_ids.write({'active': True})
            return self.manufacture_pull_id.write({'location_id': self.wh_output_manu_loc_id.id,
                                            'location_src_id': self.wh_input_manu_loc_id.id,
                                            'picking_type_id': self.manu_type_id.id})
        else:
            self._create_or_update_manufacture_pull(routes_data)
            self.manufacture_pull_id.route_id.push_ids.write({'active': False})
            self.manufacture_pull_id.route_id.pull_ids.write({'active': False})
            return self.manufacture_pull_id.write({'location_id': self.lot_stock_id.id,
                                            'location_src_id': False,
                                            'picking_type_id': self.manu_type_id.id,
                                            'active': True})

    @api.multi
    def write(self, vals):
        if not ('wh_input_manu_loc_id' in vals or 'wh_output_manu_loc_id' in vals) and self.filtered(lambda w: not w.wh_input_manu_loc_id or not w.wh_output_manu_loc_id):
            self._create_or_update_locations()
        res = super(StockWarehouse, self).write(vals)
        if 'manufacture_to_resupply' in vals:
            if vals.get("manufacture_to_resupply"):
                for warehouse in self.filtered(lambda warehouse: not warehouse.manufacture_pull_id):
                    manufacture_pull = warehouse._create_or_update_manufacture_pull(self.get_routes_dict())
                    vals['manufacture_pull_id'] = manufacture_pull.id
                for warehouse in self:
                    if not warehouse.manu_type_id:
                        warehouse._create_manufacturing_picking_type()
                    warehouse.manu_type_id.active = True
            else:
                for warehouse in self:
                    if warehouse.manu_type_id:
                        warehouse.manu_type_id.active = False
                self.mapped('manufacture_pull_id').unlink()
        if vals.get('manufacture_steps'):
            self._update_existing_manufacture_route(vals.get('manufacture_steps'))
        return res

    @api.multi
    def _get_all_routes(self):
        routes = super(StockWarehouse, self).get_all_routes_for_wh()
        routes |= self.filtered(lambda self: self.manufacture_to_resupply and self.manufacture_pull_id and self.manufacture_pull_id.route_id).mapped('manufacture_pull_id').mapped('route_id')
        return routes

    @api.multi
    def _update_name_and_code(self, name=False, code=False):
        res = super(StockWarehouse, self)._update_name_and_code(name, code)
        # change the manufacture procurement rule name
        for warehouse in self:
            if warehouse.manufacture_pull_id and name:
                warehouse.manufacture_pull_id.write({'name': warehouse.manufacture_pull_id.name.replace(warehouse.name, name, 1)})
        return res
