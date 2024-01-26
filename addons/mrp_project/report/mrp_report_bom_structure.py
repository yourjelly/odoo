#  Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models, api, _


class ReportBomStructure(models.AbstractModel):
    _name = 'report.mrp.report_bom_structure'
    _inherit = 'report.mrp.report_bom_structure'

    @api.model
    def _get_bom_data(self, bom, warehouse, product=False, line_qty=False, bom_line=False, level=0, parent_bom=False,
                      parent_product=False, index=0, product_info=False, ignore_stock=False):
        res = super()._get_bom_data(bom, warehouse, product, line_qty, bom_line, level, parent_bom, parent_product, index, product_info, ignore_stock)
        if not self.env.context.get('minimized', False):
            current_quantity = line_qty
            if bom_line:
                current_quantity = bom_line.product_uom_id._compute_quantity(line_qty, bom.product_uom_id) or 0
            services = self._get_services_lines(product, bom, current_quantity, level + 1, res['bom_cost'], index)
            res['services'] = services
            res['services_cost'] = sum(service['bom_cost'] for service in services)
            res['services_total'] = sum(service['quantity'] for service in services)
        return res

    @api.model
    def _get_services_lines(self, product, bom, bom_quantity, level, total, index):
        services = []
        company = bom.company_id or self.env.company
        service_index = 0
        for service in bom.service_ids:
            if service._skip_bom_line(product):
                continue
            line_quantity = (bom_quantity / (bom.product_qty or 1.0)) * service.product_qty
            price = service.product_id.uom_id._compute_price(
                service.product_id.with_company(company).standard_price, service.product_uom_id) * line_quantity
            services.append({
                'id': service.id,
                'index': f"{index}{service_index}",
                'type': 'service',
                'link_id': service.product_id.id if service.product_id.product_variant_count > 1 else service.product_id.product_tmpl_id.id,
                'link_model': 'product.product' if service.product_id.product_variant_count > 1 else 'product.template',
                'currency_id': company.currency_id.id,
                'name': service.product_id.display_name,
                'quantity': line_quantity,
                'uom_name': service.product_uom_id.name,
                'prod_cost': company.currency_id.round(price),
                'parent_id': bom.id,
                'level': level or 0,
                'bom_cost': company.currency_id.round(price),
            })
            service_index += 1
        return services

    @api.model
    def _get_bom_array_lines(self, data, level, unfolded_ids, unfolded, parent_unfolded=True):
        res = super()._get_bom_array_lines(data, level, unfolded_ids, unfolded, parent_unfolded)
        if data['services']:
            res.append({
                'name': _('Services'),
                'type': 'service',
                'uom': False,
                'quantity': data['services_total'],
                'bom_cost': data['services_cost'],
                'prod_cost': data['services_cost'],
                'level': level,
                'visible': parent_unfolded,
            })
            services_unfolded = unfolded or (parent_unfolded and ('services_' + str(data['index'])) in unfolded_ids)
            for service in data['services']:
                res.append({
                    'name': service['name'],
                    'type': 'service',
                    'quantity': service['quantity'],
                    'uom': service['uom_name'],
                    'prod_cost': service['prod_cost'],
                    'bom_cost': service['bom_cost'],
                    'level': level + 1,
                    'visible': services_unfolded,
                })
        return res
