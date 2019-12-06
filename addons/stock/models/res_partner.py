# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.addons.base.models.res_partner import WARNING_MESSAGE, WARNING_HELP


class Partner(models.Model):
    _inherit = 'res.partner'
    _check_company_auto = True

    property_stock_customer = fields.Many2one(
        'stock.location', string="Customer Location", company_dependent=True, check_company=True,
        domain="['|', ('company_id', '=', False), ('company_id', '=', allowed_company_ids[0])]",
        help="The stock location used as destination when sending goods to this contact.")
    property_stock_supplier = fields.Many2one(
        'stock.location', string="Vendor Location", company_dependent=True, check_company=True,
        domain="['|', ('company_id', '=', False), ('company_id', '=', allowed_company_ids[0])]",
        help="The stock location used as source when receiving goods from this contact.")
    picking_warn = fields.Selection(WARNING_MESSAGE, 'Stock Picking', help=WARNING_HELP, default='no-message')
    picking_warn_msg = fields.Text('Message for Stock Picking')
    # Computed fields to order the partners as Vendors/customers according to the
    # amount of their generated incoming/outgoing stock moves
    delivery_rank = fields.Integer(default=0)
    receipt_rank = fields.Integer(default=0)

    def _get_name_search_order_by_fields(self):
        res = super()._get_name_search_order_by_fields()
        partner_search_mode = self.env.context.get('res_partner_search_mode')
        if not partner_search_mode in ('delivery', 'reciept'):
            return res
        order_by_field = 'COALESCE(res_partner.%s, 0) DESC,'
        if partner_search_mode == 'delivery':
            field = 'delivery_rank'
        else:
            field = 'receipt_rank'
        order_by_field = order_by_field % field
        return '%s, %s' % (res, order_by_field % field) if res else order_by_field

    @api.model_create_multi
    def create(self, vals_list):
        search_partner_mode = self.env.context.get('res_partner_search_mode')
        is_delivery = search_partner_mode == 'delivery'
        is_reciept = search_partner_mode == 'reciept'
        if search_partner_mode:
            for vals in vals_list:
                if is_delivery and 'delivery_rank' not in vals:
                    vals['delivery_rank'] = 1
                elif is_reciept and 'receipt_rank' not in vals:
                    vals['receipt_rank'] = 1
        return super().create(vals_list)
