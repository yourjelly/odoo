#  Part of Odoo. See LICENSE file for full copyright and licensing details.
from collections import defaultdict

from odoo import models
from odoo.tools import float_is_zero


class ReportMoOverview(models.AbstractModel):
    _name = 'report.mrp.report_mo_overview'
    _inherit = 'report.mrp.report_mo_overview'

    def _compute_cost_sums(self, components, operations=False, services=False):
        total_mo_cost, total_real_cost = super()._compute_cost_sums(components, operations)
        if services:
            total_mo_cost += services.get('summary', {}).get('mo_cost', 0.0)
            total_real_cost += services.get('summary', {}).get('real_cost', 0.0)
        return total_mo_cost, total_real_cost

    def _get_report_extra_lines(self, summary, components, operations, production_done=False, services=False):
        extras = super()._get_report_extra_lines(summary, components, operations, production_done)
        if production_done and services:
            production_qty = summary.get('quantity', 1.0)
            extras['total_mo_cost_services'] = services.get('summary', {}).get('mo_cost', 0.0)
            extras['total_real_cost_services'] = services.get('summary', {}).get('real_cost', 0.0)
            extras['unit_mo_cost_services'] = extras['total_mo_cost_services'] / production_qty
            extras['unit_real_cost_services'] = extras['total_real_cost_services'] / production_qty
            extras['total_mo_cost'] += extras['total_mo_cost_services']
            extras['total_real_cost'] += extras['total_real_cost_services']
        return extras

    def _get_services_data(self, production, level=0, current_index=False):
        company = production.company_id or self.env.company
        currency = (production.company_id or self.env.company).currency_id
        services = []
        total_qty = total_cost = 0
        for count, service in enumerate(production.service_ids):
            price = service.product_id.uom_id._compute_price(service.product_id.with_company(company).standard_price, service.product_uom_id)
            cost = price * service.product_qty
            product = service.product_id
            total_qty += service.product_qty
            total_cost += cost
            services.append({
                'level': level,
                'index': f"{current_index}S{count}",
                'id' : product.id,
                'model': product._name,
                'name': product.display_name,
                'product_model': product._name,
                'product': product,
                'product_id': product.id,
                'quantity': service.product_qty,
                'uom': service.product_uom_id,
                'uom_name': service.product_uom_id.display_name,
                'uom_precision': self._get_uom_precision(service.product_uom_id.rounding),
                'unit_cost': price,
                'mo_cost': cost,
                'real_cost': cost,
                'currency_id': currency.id,
                'currency': currency,
            })

        return {
            'summary': {
                'index': f"{current_index}S",
                'mo_cost': total_cost,
                'real_cost': total_cost,
                'quantity': total_qty,
                'currency_id': currency.id,
                'currency': currency,
            },
            'details': services,
        }
