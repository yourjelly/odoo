#  Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models

class ReportMoOverview(models.AbstractModel):
    _name = 'report.mrp.report_mo_overview'
    _inherit = 'report.mrp.report_mo_overview'

    def _get_report_data(self, production_id):
        res = super()._get_report_data(production_id)
        production = self.env['mrp.production'].browse(production_id)
        res['services'] = self._get_services_data(production, level=1, current_index='')
        return res

    def _get_services_data(self, production, level=0, current_index=False):  # TODO clpi - to check with MGM
        company = production.company_id or self.env.company
        services = []
        total_qty = total_cost = 0
        for count, service in enumerate(production.service_ids):
            total_qty += service.product_qty
            total_cost += service.product_id.uom_id._compute_price(
                service.product_id.with_company(company).standard_price, service.product_uom_id) * service.product_qty
            services.append({
                'level': level,
                'index': f"{current_index}S{count}",
                'name': service.display_name,
                'quantity': service.product_qty,
            })

        return {
            'summary': {
                'index': f"{current_index}S",
            },
            'details': services,
        }

    def _format_service(self, production, service, level, index):  # TODO clpi - to remove
        currency = (production.company_id or self.env.company).currency_id
        product = service.product_id
        quantity = service.qty_delivered
        component = {
            'level': level,
            'index': index,
            'id': product.id,
            'model': product._name,
            'name': product.display_name,
            'product_model': product._name,
            'product': product,
            'product_id': product.id,
            'quantity': quantity,
            'uom': service.product_uom_id,
            'uom_name': service.product_uom_id.display_name,
            'uom_precision': self._get_uom_precision(service.product_uom_id.rounding),
            'unit_cost': 0,  # self._get_unit_cost(service),
            'mo_cost': currency.round(0),
            'real_cost': 0,  # currency.round(self._get_component_real_cost(service, quantity)),
            'currency_id': currency.id,
            'currency': currency,
        }
        component['mo_cost_decorator'] = self._get_comparison_decorator(component['real_cost'], component['mo_cost'], currency.rounding)
        return component
