# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _, api


class Partner(models.Model):
    _inherit = 'res.partner'

    type = fields.Selection(selection_add=[('subcontractor', 'Subcontractor')])

    def _get_name(self):
        name = super(Partner, self)._get_name()
        if self.type == 'subcontractor':
            contact_name = name.split(',')[-1]
            if not contact_name.strip():
                name += _('Subcontractor')
        return name

    @api.onchange('type')
    def _onchange_partner_type(self):
        company = self.company_id or self.parent_id.company_id
        subcontracting_location = company.subcontracting_location_id
        if self.type == 'subcontractor':
            self.update({
                'property_stock_customer': subcontracting_location,
                'property_stock_supplier': subcontracting_location
            })
        else:
            self.update({
                'property_stock_customer': self.env.ref('stock.stock_location_customers'),
                'property_stock_supplier': self.env.ref('stock.stock_location_suppliers')
            })

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('type') == 'subcontractor':
                company = vals.get('company_id') and self.env['res.company'].browse(vals['company_id']) or \
                          self.browse(vals.get('parent_id')).company_id
                subcontracting_location = company.subcontracting_location_id
                if not vals.get('property_stock_supplier') and not vals.get('property_stock_customer'):
                    vals['property_stock_supplier'] = subcontracting_location
                    vals['property_stock_customer'] = subcontracting_location
        return super(Partner, self).create(vals_list)
