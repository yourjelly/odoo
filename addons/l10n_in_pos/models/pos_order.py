# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class PosOrder(models.Model):
    _inherit = 'pos.order'

    amount_tax = fields.Float(compute='_compute_amount_all', string='Taxes', digits=0, store=True)
    amount_total = fields.Float(compute='_compute_amount_all', string='Total', digits=0, store=True)
    amount_paid = fields.Float(compute='_compute_amount_all', string='Paid', digits=0, store=True)
    amount_return = fields.Float(compute='_compute_amount_all', string='Returned', digits=0, store=True)

    @api.model
    def _get_account_move_line_group_data_type_key(self, data_type, values, options={}):
        res = super(PosOrder, self)._get_account_move_line_group_data_type_key(data_type, values, options)
        if data_type == 'tax' and res:
            if self.env['account.tax'].browse(values['tax_line_id']).l10n_in_product_wise_line:
                return res + (values['product_uom_id'], values['product_id'])
        return res

    def _create_account_move(self):
        move = super(PosOrder, self)._create_account_move()
        l10n_in_place_of_supply = self.config_id.l10n_in_place_of_supply or self.env.ref('l10n_in.state_in_ot', False)
        move.write({
            'l10n_in_gstin_partner_id': self.config_id.l10n_in_gstin_partner_id.id,
            'l10n_in_place_of_supply': l10n_in_place_of_supply and l10n_in_place_of_supply.id
        })
        return move

    def _prepare_account_move_line(self, line, partner_id, current_company, currency_id):
        res = super(PosOrder, self)._prepare_account_move_line(line, partner_id, current_company, currency_id)
        for line_values in res:
            if line_values.get('data_type') in ['tax','product']:
                line_values['values'].update({
                    'product_uom_id': line.product_id.uom_id.id,
                    })
        return res

    def _prepare_invoice(self):
        res = super(PosOrder, self)._prepare_invoice()
        l10n_in_place_of_supply = self.config_id.l10n_in_place_of_supply or self.env.ref('l10n_in.state_in_ot')
        res['l10n_in_gstin_partner_id'] = self.config_id.l10n_in_gstin_partner_id.id
        res['l10n_in_place_of_supply'] = l10n_in_place_of_supply and l10n_in_place_of_supply.id
        return res


class PosOrderLine(models.Model):
    _inherit = "pos.order.line"

    price_subtotal = fields.Float(compute='_compute_amount_line_all', digits=0, string='Subtotal w/o Tax', store=True)
    price_subtotal_incl = fields.Float(compute='_compute_amount_line_all', digits=0, string='Subtotal', store=True)
