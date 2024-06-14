# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class ResCompany(models.Model):
    _inherit = 'res.company'

    wip_location_id = fields.Many2one('stock.location')

    @api.model
    def _create_missing_wip_location(self):
        company_without_wip_loc = self.env['res.company'].search([('wip_location_id', '=', False)])
        company_without_wip_loc._create_wip_location()

    def _create_per_company_locations(self):
        super()._create_per_company_locations()
        self._create_wip_location()

    def _create_wip_location(self):
        for company in self:
            parent = self.env['product.template'].with_company(company).default_get(['property_stock_production']).get('property_stock_production')
            wip_location = self.env['stock.location'].create({
                'name': _('WIP'),
                'usage': 'production',
                'location_id': parent,
                'company_id': company.id,
            })
            self.env['ir.property']._set_default(
                "production_wip_location",
                "stock.picking.type",
                wip_location,
                company,
            )
            self.env['stock.picking.type'].with_company(company).search([('code', '=', 'mrp_operation')]).write({
                'production_wip_location': wip_location.id
            })
            company.wip_location_id = wip_location
