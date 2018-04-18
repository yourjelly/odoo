# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import api, models
from odoo.tools.safe_eval import safe_eval


class AccountGenericGstReport(models.AbstractModel):

    _name = "account.generic.gst.report"

    @api.model
    def _get_model_data_res_id(self, module, name):
        return "(SELECT res_id FROM ir_model_data WHERE module='%s' AND name='%s')"%(module, name)

    @api.model
    def _get_tax_group_ids(self):
        sgst_group = self._get_model_data_res_id('l10n_in', 'sgst_group')
        cgst_group = self._get_model_data_res_id('l10n_in', 'cgst_group')
        igst_group = self._get_model_data_res_id('l10n_in', 'igst_group')
        return {'sgst_group': sgst_group, 'cgst_group': cgst_group, 'igst_group': igst_group}

    @api.model
    def _get_cess_amount(self, account_invoice_lines):
        AccountTax = self.env['account.tax']
        cess_group = self.env.ref('l10n_in.cess_group', False)
        cess_amount_count = 0
        itc_cess_amount_count = 0
        for account_invoice_line in account_invoice_lines:
            price_unit = account_invoice_line.price_unit * (1 - (account_invoice_line.discount or 0.0) / 100.0)
            tax_lines = account_invoice_line.invoice_line_tax_ids.compute_all(price_unit, account_invoice_line.invoice_id.currency_id,
                account_invoice_line.quantity, account_invoice_line.product_id, account_invoice_line.invoice_id.partner_id)['taxes']
            for tax_line in tax_lines:
                tax = AccountTax.browse(tax_line['id'])
                if cess_group and cess_group.id == tax.tax_group_id.id:
                    cess_amount_count += tax_line.get('amount')
                    itc_cess_amount_count += account_invoice_line.is_eligible_for_itc and tax_line.get('amount') or 0
        return {'cess_amount': cess_amount_count, 'itc_cess_amount': itc_cess_amount_count}

    @api.model
    def _get_default_gst_rate(self, type):
        #Give default sale gst tax rate if Any GST tax select in account setting else return 18(default as per Indian GSTR guidelines).
        default_tax_rate = 18
        company_id = self.env.user.company_id
        default_tax_id = False
        if type == 'sale':
            default_tax_id = company_id.account_sale_tax_id
        if type == 'purchase':
            default_tax_id = company_id.account_purchase_tax_id
        if default_tax_id:
            if default_tax_id.amount_type == 'group':
                default_tax_rate = sum(default_tax_id.children_tax_ids.mapped('amount'))
            else:
                default_tax_rate = default_tax_id.amount
        return default_tax_rate

    def _get_related_payment(self, invoice, payment):
        payment_move_lines  = invoice.payment_move_line_ids
        related_payment = 0
        if  payment.id in payment_move_lines.mapped('payment_id').ids:
            if invoice.type == 'out_invoice':
                related_payment = sum([p.amount for p in payment_move_lines.matched_debit_ids if p.debit_move_id in invoice.move_id.line_ids])
            if invoice.type == 'in_invoice':
                related_payment = sum([p.amount for p in payment_move_lines.matched_credit_ids if p.credit_move_id in invoice.move_id.line_ids])
        return related_payment
