# -*- coding: utf-8 -*-

import json

from odoo import api, fields, models, _
from odoo.tools import float_compare, float_round, format_date
from datetime import datetime, timedelta

class ReportBomStructure(models.AbstractModel):
    _name = 'report.mrp.report_bom_structure'
    _description = 'BOM Overview Report'

    @api.model
    def _get_report_values(self, docids, data=None):
        docs = []
        for bom_id in docids:
            bom = self.env['mrp.bom'].browse(bom_id)
            variant = data.get('variant')
            candidates = variant and self.env['product.product'].browse(int(variant)) or bom.product_id or bom.product_tmpl_id.product_variant_ids
            quantity = float(data.get('quantity', bom.product_qty))
            if data.get('warehouse_id'):
                self = self.with_context(warehouse=int(data.get('warehouse_id')))
            for product_variant_id in candidates.ids:
                docs.append(self._get_pdf_doc(bom_id, data, quantity, product_variant_id))
            if not candidates:
                docs.append(self._get_pdf_doc(bom_id, data, quantity))
        return {
            'doc_ids': docids,
            'doc_model': 'mrp.bom',
            'docs': docs,
        }

    @api.model
    def _get_pdf_doc(self, bom_id, data, quantity, product_variant_id=None):
        if data and data.get('unfolded_ids'):
            doc = self._get_pdf_line(bom_id, product_id=product_variant_id, qty=quantity, unfolded_ids=set(json.loads(data.get('unfolded_ids'))))
        else:
            doc = self._get_pdf_line(bom_id, product_id=product_variant_id, qty=quantity, unfolded=True)
        doc['show_availabilities'] = False if data and data.get('availabilities') == 'false' else True
        doc['show_costs'] = False if data and data.get('costs') == 'false' else True
        doc['show_operations'] = False if data and data.get('operations') == 'false' else True
        doc['show_lead_times'] = False if data and data.get('lead_times') == 'false' else True
        return doc

    @api.model
    def get_html(self, bom_id=False, searchQty=1, searchVariant=False):
        res = self._get_report_data(bom_id=bom_id, searchQty=searchQty, searchVariant=searchVariant)
        res['has_attachments'] = self._has_attachments(res['lines'])
        return res

    @api.model
    def _get_report_data(self, bom_id, searchQty=0, searchVariant=False):
        lines = {}
        bom = self.env['mrp.bom'].browse(bom_id)
        bom_quantity = searchQty or bom.product_qty or 1
        bom_product_variants = {}
        bom_uom_name = ''

        if searchVariant:
            product = self.env['product.product'].browse(int(searchVariant))
        else:
            product = bom.product_id or bom.product_tmpl_id.product_variant_id

        if bom:
            bom_uom_name = bom.product_uom_id.name

            # Get variants used for search
            if not bom.product_id:
                for variant in bom.product_tmpl_id.product_variant_ids:
                    bom_product_variants[variant.id] = variant.display_name

        if self.env.context.get('warehouse'):
            warehouse = self.env['stock.warehouse'].browse(self.env.context.get('warehouse'))
        else:
            warehouse = self.env['stock.warehouse'].browse(self.get_warehouses()[0]['id'])

        lines = self._get_bom_data(bom, warehouse, product=product, line_qty=bom_quantity, level=0)
        return {
            'lines': lines,
            'variants': bom_product_variants,
            'bom_uom_name': bom_uom_name,
            'bom_qty': bom_quantity,
            'is_variant_applied': self.env.user.user_has_groups('product.group_product_variant') and len(bom_product_variants) > 1,
            'is_uom_applied': self.env.user.user_has_groups('uom.group_uom'),
        }

    @api.model
    def _get_bom_data(self, bom, warehouse, product=False, line_qty=False, bom_line=False, level=0, parent_bom=False, index=0, extra_data=False):
        """ Gets recursively the BoM and all its subassemblies and computes availibility estimations for each component and their disponibility in stock.
            Accepts specific keys in context that will cut some data received :
            - 'minimized': Will cut all data not required to compute availability estimations.
            - 'empty_stock': Will compute availability timings as if the stock was empty.
        """
        is_minimized = self.env.context.get('minimized', False)
        if not product:
            product = bom.product_id or bom.product_tmpl_id.product_variant_id
        if not line_qty:
            line_qty = bom.product_qty

        if not extra_data:
            extra_data = {}
        extra_key = product.id
        if extra_key not in extra_data:
            extra_data[extra_key] = {'consumptions': {'in_stock': 0}}

        company = bom.company_id or self.env.company
        current_quantity = line_qty
        if bom_line:
            current_quantity = bom_line.product_uom_id._compute_quantity(line_qty, bom.product_uom_id) or 0

        prod_cost = 0
        attachment_ids = []
        if not is_minimized:
            if product:
                prod_cost = product.uom_id._compute_price(product.with_company(company).standard_price, bom.product_uom_id) * current_quantity
                attachment_ids = self.env['mrp.document'].search(['|', '&', ('res_model', '=', 'product.product'),
                                                                 ('res_id', '=', product.id), '&', ('res_model', '=', 'product.template'),
                                                                 ('res_id', '=', product.product_tmpl_id.id)]).ids
            else:
                # Use the product template instead of the variant
                prod_cost = bom.product_tmpl_id.uom_id._compute_price(bom.product_tmpl_id.with_company(company).standard_price, bom.product_uom_id) * current_quantity
                attachment_ids = self.env['mrp.document'].search([('res_model', '=', 'product.template'), ('res_id', '=', bom.product_tmpl_id.id)]).ids

        if not extra_data[extra_key].get(bom.id):
            extra_data[extra_key][bom.id] = self._get_resupply_route_info(warehouse, product, current_quantity, bom)
        route_info = extra_data[extra_key].get(bom.id, {})
        quantities_info = {}
        if not self.env.context.get('without_stock', False):
            # Useless to compute quantities_info if it's not going to be used later on
            quantities_info = self._getAvailableQuantities(product, parent_bom, extra_data)

        bom_cost = 0
        bom_report_line = {
            'index': index,
            'bom': bom,
            'bom_id': bom and bom.id or False,
            'bom_code': bom and bom.code or False,
            'type': 'bom',
            'quantity': current_quantity,
            'quantity_available': quantities_info.get('free_qty', 0),
            'quantity_on_hand': quantities_info.get('on_hand_qty', 0),
            'name': product.display_name,
            'uom': bom.product_uom_id.name if bom else product.uom_id.name,
            'route_type': route_info.get('route_type', ''),
            'route_name': route_info.get('route_name', ''),
            'route_detail': route_info.get('route_detail', ''),
            'lead_time': route_info.get('lead_time', False),
            'currency': company.currency_id,
            'currency_id': company.currency_id.id,
            'product': product,
            'product_id': product.id,
            'link_id': product.id if product.product_variant_count > 1 else product.product_tmpl_id.id,
            'link_model': 'product.product' if product.product_variant_count > 1 else 'product.template',
            'code': bom and bom.display_name or '',
            'prod_cost': prod_cost,
            'level': level or 0,
            'attachment_ids': attachment_ids,
            'phantom_bom': bom.type == 'phantom',
            'parent_id': parent_bom and parent_bom.id or False,
        }

        if not is_minimized:
            operations = self._get_operation_line(product, bom, float_round(current_quantity, precision_rounding=1, rounding_method='UP'), level + 1, index)
            bom_report_line['operations'] = operations
            bom_report_line['operations_cost'] = sum([op['bom_cost'] for op in operations])
            bom_report_line['operations_time'] = sum([op['quantity'] for op in operations])
            bom_cost += bom_report_line['operations_cost']

        components = []
        component_index = 1
        for line in bom.bom_line_ids:
            new_index = f"{index}{component_index}"
            if line._skip_bom_line(product):
                continue
            line_quantity = (current_quantity / (bom.product_qty or 1.0)) * line.product_qty
            if line.child_bom_id:
                component = self._get_bom_data(line.child_bom_id, warehouse, line.product_id, line_quantity, bom_line=line, level=level + 1, parent_bom=bom, index=new_index, extra_data=extra_data)
            else:
                component = self._get_component_data(bom, warehouse, line, line_quantity, level + 1, new_index, extra_data)
            components.append(component)
            component_index += 1
            if not is_minimized:
                bom_cost += component['bom_cost']

        if not is_minimized:
            byproducts, byproduct_cost_portion = self._get_byproducts_lines(product, bom, current_quantity, level + 1, bom_cost, index)
            bom_report_line['byproducts'] = byproducts
            bom_report_line['cost_share'] = float_round(1 - byproduct_cost_portion, precision_rounding=0.0001)
            bom_report_line['byproducts_cost'] = sum(byproduct['bom_cost'] for byproduct in byproducts)
            bom_report_line['byproducts_total'] = sum(byproduct['quantity'] for byproduct in byproducts)
            bom_report_line['bom_cost'] = bom_cost * bom_report_line['cost_share']

        avail_state, avail_display, avail_date, avail_delay = self._get_availability_date(product, current_quantity, quantities_info, level, components, bom, extra_data)
        bom_report_line['availability_state'] = avail_state
        bom_report_line['availability_display'] = avail_display
        bom_report_line['availability_date'] = avail_date
        bom_report_line['availability_delay'] = avail_delay

        bom_report_line['components'] = components
        if level == 0:
            # Gives a unique key for the first line that indicates if product is ready for production right now.
            bom_report_line['components_available'] = all([c['availability_state'] == 'available' for c in components])
        return bom_report_line

    @api.model
    def _get_component_data(self, parent_bom, warehouse, bom_line, line_quantity, level, index, extra_data):
        company = parent_bom.company_id or self.env.company
        extra_key = bom_line.product_id.id
        if extra_key not in extra_data:
            extra_data[extra_key] = {'consumptions': {'in_stock': 0}}

        price = bom_line.product_id.uom_id._compute_price(bom_line.product_id.with_company(company).standard_price, bom_line.product_uom_id) * line_quantity
        rounded_price = company.currency_id.round(price)

        if not extra_data[extra_key].get('no_bom'):
            extra_data[extra_key]['no_bom'] = self._get_resupply_route_info(warehouse, bom_line.product_id, line_quantity)
        route_info = extra_data[extra_key].get('no_bom', {})

        attachment_ids = []
        if not self.env.context.get('minimized', False):
            attachment_ids = self.env['mrp.document'].search(['|', '&', ('res_model', '=', 'product.product'), ('res_id', '=', bom_line.product_id.id),
                                                             '&', ('res_model', '=', 'product.template'), ('res_id', '=', bom_line.product_id.product_tmpl_id.id)]).ids

        quantities_info = {}
        if not self.env.context.get('without_stock', False):
            # Useless to compute quantities_info if it's not going to be used later on
            quantities_info = self._getAvailableQuantities(bom_line.product_id, parent_bom, extra_data)
        avail_state, avail_display, avail_date, avail_delay = self._get_availability_date(bom_line.product_id, line_quantity, quantities_info, level, extra_data=extra_data)

        return {
            'type': 'bom',
            'index': index,
            'bom_id': False,
            'product': bom_line.product_id,
            'product_id': bom_line.product_id.id,
            'link_id': bom_line.product_id.id if bom_line.product_id.product_variant_count > 1 else bom_line.product_id.product_tmpl_id.id,
            'link_model': 'product.product' if bom_line.product_id.product_variant_count > 1 else 'product.template',
            'name': bom_line.product_id.display_name,
            'code': '',
            'currency': company.currency_id,
            'currency_id': company.currency_id.id,
            'quantity': line_quantity,
            'quantity_available': quantities_info.get('free_qty', 0),
            'quantity_on_hand': quantities_info.get('on_hand_qty', 0),
            'uom': bom_line.product_uom_id.name,
            'prod_cost': rounded_price,
            'bom_cost': rounded_price,
            'route_type': route_info.get('route_type', ''),
            'route_name': route_info.get('route_name', ''),
            'route_detail': route_info.get('route_detail', ''),
            'lead_time': route_info.get('lead_time', False),
            'parent_id': parent_bom.id,
            'level': level or 0,
            'availability_date': avail_date,
            'availability_display': avail_display,
            'availability_state': avail_state,
            'availability_delay': avail_delay,
            'attachment_ids': attachment_ids,
        }

    @api.model
    def _getAvailableQuantities(self, product, parent_bom, extra_data):
        return {
            'free_qty': product.free_qty if product.detailed_type == 'product' else False,
            'on_hand_qty': product.qty_available if product.detailed_type == 'product' else False,
            'stock_loc': 'in_stock',
        }

    @api.model
    def _get_byproducts_lines(self, product, bom, bom_quantity, level, total, index):
        byproducts = []
        byproduct_cost_portion = 0
        company = bom.company_id or self.env.company
        byproduct_index = 0
        for byproduct in bom.byproduct_ids:
            if byproduct._skip_byproduct_line(product):
                continue
            line_quantity = (bom_quantity / (bom.product_qty or 1.0)) * byproduct.product_qty
            cost_share = byproduct.cost_share / 100
            byproduct_cost_portion += cost_share
            price = byproduct.product_id.uom_id._compute_price(byproduct.product_id.with_company(company).standard_price, byproduct.product_uom_id) * line_quantity
            byproducts.append({
                'id': byproduct.id,
                'index': f"{index}{byproduct_index}",
                'type': 'byproduct',
                'link_id': byproduct.product_id.id if byproduct.product_id.product_variant_count > 1 else byproduct.product_id.product_tmpl_id.id,
                'link_model': 'product.product' if byproduct.product_id.product_variant_count > 1 else 'product.template',
                'currency_id': company.currency_id.id,
                'name': byproduct.product_id.display_name,
                'quantity': line_quantity,
                'uom': byproduct.product_uom_id.name,
                'prod_cost': company.currency_id.round(price),
                'parent_id': bom.id,
                'level': level or 0,
                'bom_cost': company.currency_id.round(total * cost_share),
                'cost_share': cost_share,
            })
            byproduct_index += 1
        return byproducts, byproduct_cost_portion

    @api.model
    def _get_operation_line(self, product, bom, qty, level, index):
        operations = []
        total = 0.0
        qty = bom.product_uom_id._compute_quantity(qty, bom.product_tmpl_id.uom_id)
        company = bom.company_id or self.env.company
        operation_index = 0
        for operation in bom.operation_ids:
            if operation._skip_operation_line(product):
                continue
            capacity = operation.workcenter_id._get_capacity(product)
            operation_cycle = float_round(qty / capacity, precision_rounding=1, rounding_method='UP')
            duration_expected = (operation_cycle * operation.time_cycle * 100.0 / operation.workcenter_id.time_efficiency) + (operation.workcenter_id.time_stop + operation.workcenter_id.time_start)
            total = ((duration_expected / 60.0) * operation.workcenter_id.costs_hour)
            operations.append({
                'type': 'operation',
                'index': f"{index}{operation_index}",
                'level': level or 0,
                'operation': operation,
                'link_id': operation.id,
                'link_model': 'mrp.routing.workcenter',
                'name': operation.name + ' - ' + operation.workcenter_id.name,
                'uom': _("Minutes"),
                'quantity': duration_expected,
                'bom_cost': self.env.company.currency_id.round(total),
                'currency_id': company.currency_id.id,
                'model': 'mrp.routing.workcenter',
            })
            operation_index += 1
        return operations

    @api.model
    def _get_pdf_line(self, bom_id, product_id=False, qty=1, unfolded_ids=None, unfolded=False):
        if unfolded_ids is None:
            unfolded_ids = set()

        bom = self.env['mrp.bom'].browse(bom_id)
        if product_id:
            product = self.env['product.product'].browse(int(product_id))
        else:
            product = bom.product_id or bom.product_tmpl_id.product_variant_id

        if self.env.context.get('warehouse'):
            warehouse = self.env['stock.warehouse'].browse(self.env.context.get('warehouse'))
        else:
            warehouse = self.env['stock.warehouse'].browse(self.get_warehouses()[0]['id'])

        level = 1
        data = self._get_bom_data(bom, warehouse, product=product, line_qty=qty, level=0)
        pdf_lines = self._get_bom_array_lines(data, level, unfolded_ids, unfolded, True)

        data['lines'] = pdf_lines
        return data

    @api.model
    def _get_bom_array_lines(self, data, level, unfolded_ids, unfolded, parent_unfolded=True):
        bom_lines = data['components']
        lines = []
        for bom_line in bom_lines:
            line_unfolded = ('bom_' + str(bom_line['index'])) in unfolded_ids
            line_visible = level == 1 or unfolded or parent_unfolded
            lines.append({
                'bom_id': bom_line['bom_id'],
                'name': bom_line['name'],
                'type': 'bom',
                'quantity': bom_line['quantity'],
                'quantity_available': bom_line['quantity_available'],
                'quantity_on_hand': bom_line['quantity_on_hand'],
                'uom': bom_line['uom'],
                'prod_cost': bom_line['prod_cost'],
                'bom_cost': bom_line['bom_cost'],
                'route_name': bom_line['route_name'],
                'route_detail': bom_line['route_detail'],
                'lead_time': bom_line['lead_time'],
                'level': bom_line['level'],
                'code': bom_line['code'],
                'availability_state': bom_line['availability_state'],
                'availability_display': bom_line['availability_display'],
                'availability_date': bom_line['availability_date'],
                'visible': line_visible,
            })
            if bom_line.get('components'):
                lines += self._get_bom_array_lines(bom_line, level + 1, unfolded_ids, unfolded, line_visible and line_unfolded)

        if data['operations']:
            lines.append({
                'name': _('Operations'),
                'type': 'operation',
                'quantity': data['operations_time'],
                'uom': _('minutes'),
                'bom_cost': data['operations_cost'],
                'level': level,
                'visible': parent_unfolded,
            })
            operations_unfolded = unfolded or (parent_unfolded and ('operations_' + str(data['index'])) in unfolded_ids)
            for operation in data['operations']:
                lines.append({
                    'name': operation['name'],
                    'type': 'operation',
                    'quantity': operation['quantity'],
                    'uom': _('minutes'),
                    'bom_cost': operation['bom_cost'],
                    'level': level + 1,
                    'visible': operations_unfolded,
                })
        if data['byproducts']:
            lines.append({
                'name': _('Byproducts'),
                'type': 'byproduct',
                'uom': False,
                'quantity': data['byproducts_total'],
                'bom_cost': data['byproducts_cost'],
                'level': level,
                'visible': parent_unfolded,
            })
            byproducts_unfolded = unfolded or (parent_unfolded and ('byproducts_' + str(data['index'])) in unfolded_ids)
            for byproduct in data['byproducts']:
                lines.append({
                    'name': byproduct['name'],
                    'type': 'byproduct',
                    'quantity': byproduct['quantity'],
                    'uom': byproduct['uom'],
                    'prod_cost': byproduct['prod_cost'],
                    'bom_cost': byproduct['bom_cost'],
                    'level': level + 1,
                    'visible': byproducts_unfolded,
                })
        return lines

    @api.model
    def _get_resupply_route_info(self, warehouse, product, quantity, bom=False):
        rule = self._get_resupply_rule(warehouse, product)
        if not rule:
            return {}
        return self._format_route_info(rule, product, bom, quantity)

    @api.model
    def _format_route_info(self, rule, product, bom, quantity):
        if rule.action == 'manufacture' and bom:
            return {
                'route_type': 'manufacture',
                'route_name': rule.route_id.display_name,
                'route_detail': bom.display_name,
                'lead_time': product.produce_delay,
                'manufacture_delay': product.produce_delay,
            }
        return {}

    @api.model
    def _get_availability_date(self, product, quantity, quantities_info, level, children_lines=False, bom=False, extra_data=False):
        date_now = fields.Datetime.today()
        # Check for immediate availability
        if level != 0 and product.detailed_type != 'product':
            return ('available', _('Available'), date_now, 0)

        if level != 0 and not self.env.context.get('without_stock', False):
            stock_loc = quantities_info['stock_loc']
            extra_data[product.id]['consumptions'][stock_loc] += quantity
            # Check if product is already in stock with enough quantity
            if float_compare(extra_data[product.id]['consumptions'][stock_loc], quantities_info['free_qty'], precision_rounding=product.uom_id.rounding) <= 0:
                return ('available', _('Available'), date_now, 0)

            # No need to check forecast if the product isn't located in our stock
            if stock_loc == 'in_stock':
                # Check if product will come in stock in the future
                domain = [('state', '=', 'forecast'), ('date', '>=', date_now), ('product_id', '=', product.id), ('product_qty', '>=', extra_data[product.id]['consumptions'][stock_loc])]
                if self.env.context.get('warehouse'):
                    domain.append(('warehouse_id', '=', self.env.context.get('warehouse')))

                closest_forecasted = self.env['report.stock.quantity']._read_group(domain, ['min_date:min(date)', 'product_id'], ['product_id'])
                if closest_forecasted:
                    forecasted_date = datetime.combine(closest_forecasted[0]['min_date'], datetime.min.time())
                    delta = forecasted_date - date_now
                    return ('expected', _('Expected %s', format_date(self.env, forecasted_date)), forecasted_date, max(delta.days, 0))

        key = bom.id if bom else 'no_bom'
        route_info = extra_data[product.id].get(key)

        # No route defined
        if not route_info:
            return ('unavailable', _('Not Available'), False, False)

        return self._get_estimated_availability(date_now, route_info, children_lines)

    @api.model
    def _get_estimated_availability(self, date_today, route_data, children_lines):
        if route_data.get('route_type') == 'manufacture':
            max_comp_delay = 0
            for line in children_lines:
                if line.get('availability_delay', False) is False:
                    return ('unavailable', _('Not Available'), False, False)
                max_comp_delay = max(max_comp_delay, line.get('availability_delay'))

            current_delay = route_data.get('manufacture_delay', 0) + max_comp_delay
            availability_date = date_today + timedelta(days=current_delay)
            return ('estimated', _('Estimated %s', format_date(self.env, availability_date)), availability_date, current_delay)
        return ('unavailable', _('Not Available'), False, False)

    @api.model
    def _has_attachments(self, data):
        return data['attachment_ids'] or any(self._has_attachments(component) for component in data.get('components', []))

    @api.model
    def get_warehouses(self):
        return self.env['stock.warehouse'].search_read([('company_id', '=', self.env.company.id)], fields=['id', 'name'])

    @api.model
    def _get_resupply_rule(self, warehouse, product):
        found_rules = product._get_rules_from_location(warehouse.lot_stock_id)
        return found_rules[0] if found_rules else found_rules
