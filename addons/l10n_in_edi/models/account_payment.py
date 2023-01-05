# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class AccountMove(models.Model):
    _inherit = "account.payment"

    l10n_in_edi_tax_ids = fields.Many2many(
        'account.tax', 'l10n_in_edi_account_payment_taxes_rel',
        'payment_id', 'tax_id', string='Taxes',
    )
    # Technical field to filter out the sales/purchase taxes based on payment `Type` selection
    l10n_in_edi_tax_type = fields.Selection([
        ('sale', 'Sale'), ('purchase', 'Purchase')
    ], compute='_compute_tax_type')

    @api.depends('payment_type')
    def _compute_tax_type(self):
        for payment in self:
            payment.l10n_in_edi_tax_type = 'purchase' if payment.payment_type == 'outbound' else 'sale'

    @api.onchange('payment_type')
    def _onchange_payment_type(self):
        self.l10n_in_edi_tax_ids = False

    @api.model
    def _get_trigger_fields_to_synchronize(self):
        fields_to_synchronize = super()._get_trigger_fields_to_synchronize()
        return fields_to_synchronize + ('l10n_in_edi_tax_ids',)

    def write(self, vals):
        # OVERRIDE
        if 'l10n_in_edi_tax_ids' in vals.keys():
            for pay in self.with_context(check_move_validity=False, skip_account_move_synchronization=True):
                pay.move_id.write({'line_ids': [(2, tax_line.id) for tax_line in pay.move_id.line_ids if tax_line.tax_line_id]})
        res = super().write(vals)
        return res

    def _prepare_move_line_default_vals(self, write_off_line_vals=None):
        def _compute_base_line_taxes(base_line):
            ''' Compute taxes amounts both in company currency / foreign currency as the ratio between
            amount_currency & balance could not be the same as the expected currency rate.
            The 'amount_currency' value will be set on compute_all(...)['taxes'] in multi-currency.
            :param base_line:   The account.move.line owning the taxes.
            :return:            The result of the compute_all method.
            '''
            if self.partner_type == 'customer':
                sign = -1 if self.payment_type == 'outbound' else 1
                is_refund = self.payment_type == 'inbound' and True or False
            else:
                sign = -1 if self.payment_type == 'outbound' else 1
                is_refund = self.payment_type == 'outbound' and True or False

            return self.l10n_in_edi_tax_ids.with_context(force_sign=sign).compute_all(
                payment_amount,
                currency=self.company_id.currency_id,
                quantity=1,
                partner=self.partner_id,
                is_refund=is_refund,
                handle_price_include=False,
                include_caba_tags=False,
            )
        res = super()._prepare_move_line_default_vals(write_off_line_vals=write_off_line_vals)
        payment_amount = 0.00
        total_tax_amount = 0.00
        copy_of_res = res.copy()
        for index, line in enumerate(copy_of_res):
            if line['account_id'] == self.destination_account_id.id:
                res[index].update({'tax_ids': [(6, 0, self.l10n_in_edi_tax_ids.ids)]})
                # set tax line
                payment_amount +=  line['debit'] - line['credit']
                compute_all_vals = _compute_base_line_taxes(line)
                # Assign tags on base line
                for tax_vals in compute_all_vals['taxes']:
                    tax_repartition_line = self.env['account.tax.repartition.line'].browse(tax_vals['tax_repartition_line_id'])
                    tax = tax_repartition_line.invoice_tax_id or tax_repartition_line.refund_tax_id
                    # Receivable / Payable.
                    balance = tax_vals['amount']
                    res.append({
                            'name': tax.name,
                            'date_maturity': self.date,
                            'currency_id': self.company_id.currency_id.id,
                            'debit': balance if balance > 0.0 else 0.0,
                            'credit': -balance if balance < 0.0 else 0.0,
                            'partner_id': self.partner_id.id,
                            'account_id': tax_repartition_line.account_id.id or self.destination_account_id.id,
                            'tax_base_amount': abs(payment_amount),
                            'tax_repartition_line_id': tax_vals['tax_repartition_line_id'],
                            'tax_tag_ids': [(6, 0, tax_repartition_line.tag_ids.ids)]
                        })
                    total_tax_amount += balance
        for index, line in enumerate(copy_of_res):
            if line['account_id'] == self.outstanding_account_id.id:
                if line.get('credit'):
                    res[index].update({'credit': line['credit'] + total_tax_amount})
                if line.get('debit'):
                    res[index].update({'debit': line['debit'] + (total_tax_amount * -1)})
        return res

    def _seek_for_lines(self):
        liquidity_lines, counterpart_lines, writeoff_lines = super()._seek_for_lines()
        if writeoff_lines:
            writeoff_lines = writeoff_lines.filtered(lambda l: not l.tax_repartition_line_id)
        return liquidity_lines, counterpart_lines, writeoff_lines
