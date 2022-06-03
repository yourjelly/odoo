# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, _
from odoo.tools import format_date
from datetime import timedelta

class ReportBomStructure(models.AbstractModel):
    _inherit = 'report.mrp.report_bom_structure'

    def _get_subcontracting_line(self, bom, seller, level, bom_quantity):
        ratio_uom_seller = seller.product_uom.ratio / bom.product_uom_id.ratio
        return {
            'name': seller.partner_id.display_name,
            'partner_id': seller.partner_id.id,
            'quantity': bom_quantity,
            'uom': bom.product_uom_id.name,
            'prod_cost': seller.price / ratio_uom_seller * bom_quantity,
            'bom_cost': seller.price / ratio_uom_seller * bom_quantity,
            'level': level or 0
        }

    def _get_bom_data(self, bom, warehouse, product=False, line_qty=False, bom_line=False, level=0, parent_bom=False, index=0, extra_data=False):
        res = super()._get_bom_data(bom, warehouse, product, line_qty, bom_line, level, parent_bom, index, extra_data)
        if bom.type == 'subcontract' and not self.env.context.get('minimized', False):
            seller = res['product']._select_seller(quantity=res['quantity'], uom_id=bom.product_uom_id, params={'subcontractor_ids': bom.subcontractor_ids})
            if seller:
                res['subcontracting'] = self._get_subcontracting_line(bom, seller, level + 1, res['quantity'])
                if not self.env.context.get('minimized', False):
                    res['bom_cost'] += res['subcontracting']['bom_cost']
        return res

    def _get_bom_array_lines(self, data, level, unfolded_ids, unfolded, parent_unfolded):
        lines = super()._get_bom_array_lines(data, level, unfolded_ids, unfolded, parent_unfolded)

        if data.get('subcontracting'):
            subcontract_info = data['subcontracting']
            lines.append({
                'name': _("Subcontracting: %s", subcontract_info['name']),
                'type': 'subcontract',
                'uom': False,
                'quantity': subcontract_info['quantity'],
                'bom_cost': subcontract_info['bom_cost'],
                'prod_cost': subcontract_info['prod_cost'],
                'level': subcontract_info['level'],
                'visible': level == 1 or unfolded or parent_unfolded
            })
        return lines

    @api.model
    def _format_route_info(self, rule, product, bom, quantity):
        res = super()._format_route_info(rule, product, bom, quantity)
        if rule.action == 'buy' and bom and bom.type == 'subcontract':
            supplier = product._select_seller(quantity=quantity, uom_id=product.uom_id, params={'subcontractor_ids': bom.subcontractor_ids})
            if supplier:
                return {
                    'route_type': 'subcontract',
                    'route_name': rule.route_id.display_name,
                    'route_detail': supplier.display_name,
                    'lead_time': supplier.delay,
                    'supplier_delay': supplier.delay,
                    'manufacture_delay': product.produce_delay,
                    'supplier': supplier,
                }

        return res

    @api.model
    def _getAvailableQuantities(self, product, parent_bom, extra_data):
        if parent_bom and parent_bom.type == 'subcontract' and product.detailed_type == 'product':
            parent_product = parent_bom.product_id or parent_bom.product_tmpl_id.product_variant_id
            route_info = extra_data[parent_product.id].get(parent_bom.id, {})
            if route_info and route_info['route_type'] == 'subcontract':
                subcontracting_loc = route_info['supplier'].partner_id.property_stock_subcontractor
                subloc_product = product.with_context(location=subcontracting_loc.id, warehouse=False).read(['free_qty', 'qty_available'])[0]
                stock_loc = f"subcontract_{subcontracting_loc.id}"
                if not extra_data[product.id]['consumptions'].get(stock_loc, False):
                    extra_data[product.id]['consumptions'][stock_loc] = 0
                return {
                    'free_qty': subloc_product['free_qty'],
                    'on_hand_qty': subloc_product['qty_available'],
                    'stock_loc': stock_loc,
                }
        return super()._getAvailableQuantities(product, parent_bom, extra_data)

    @api.model
    def _get_estimated_availability(self, date_today, route_data, children_lines):
        if route_data.get('route_type') == 'subcontract':
            max_comp_delay = 0
            for line in children_lines:
                if line.get('availability_delay', False) is False:
                    return ('unavailable', _('Not Available'), False, False)
                max_comp_delay = max(max_comp_delay, line.get('availability_delay'))

            produce_delay = route_data.get('manufacture_delay', 0) + max_comp_delay
            supply_delay = route_data.get('supplier_delay', 0)
            current_delay = max(produce_delay, supply_delay)
            availability_date = date_today + timedelta(days=current_delay)
            return ('estimated', _('Estimated %s', format_date(self.env, availability_date)), availability_date, current_delay)
        return super()._get_estimated_availability(date_today, route_data, children_lines)
