# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class PosOrder(models.Model):
    _inherit = 'pos.order'

    def _prepare_move_line(self, line, partner_id, current_company, cur):
        res = super(PosOrder, self)._prepare_move_line(line, partner_id, current_company, cur)
        for line_values in res:
            if line_values.get('data_type') == 'product':
                price = line.price_unit * (1 - (line.discount or 0.0) / 100.0)
                line_values['values'].update({
                    'l10n_in_tax_price_unit': price,
                    })
        return res

    def _account_move_line_group_by_sum_fields(self):
        res = super(PosOrder, self)._account_move_line_group_by_sum_fields()
        return res + ['l10n_in_tax_price_unit']

    @api.multi
    def _get_l10n_in_place_of_supply(self):
        self.ensure_one()
        l10n_in_place_of_supply = self.company_id.state_id.country_id.code = 'IN' and self.company_id.state_id or self.env.ref('l10n_in.state_in_ot', False)
        if l10n_in_place_of_supply:
            return l10n_in_place_of_supply.id
        return False

    @api.multi
    def _create_account_move_line(self, session=None, move=None):
        res = super(PosOrder, self)._create_account_move_line(session=session, move=move)
        for order in self:
            l10n_in_place_of_supply = order._get_l10n_in_place_of_supply()
            if order.account_move:
                order.account_move.write({
                    'l10n_in_place_of_supply': l10n_in_place_of_supply})
            payment = self.env['account.payment']
            move = self.env['account.move']
            for journal_entry_id in order.statement_ids.mapped('journal_entry_ids'):
                if journal_entry_id.move_id not in move:
                    move += journal_entry_id.move_id
                if journal_entry_id.payment_id not in payment:
                    payment += journal_entry_id.payment_id
            move.write({
                'l10n_in_place_of_supply': l10n_in_place_of_supply})
            payment.write({
                'l10n_in_place_of_supply': l10n_in_place_of_supply})
        return res

    def _prepare_invoice(self):
        res = super(PosOrder, self)._prepare_invoice()
        res['l10n_in_place_of_supply'] = self._get_l10n_in_place_of_supply()
        return res
