# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class StockMove(models.Model):
    _inherit = "stock.move"
    _description = "Stock Move Ewaybill"

    ewaybill_id = fields.Many2one(
        comodel_name='l10n.in.ewaybill',
        required=True)

    ewaybill_company_currency_id = fields.Many2one(
        comodel_name='res.currency',
        related='company_id.currency_id', readonly=True)

    ewaybill_price_unit = fields.Float(
        string="Unit Price",
        compute='_compute_ewaybill_price_unit',
        digits='Product Price', readonly=True)

    ewaybill_tax_ids = fields.Many2many(
        comodel_name='account.tax',
        string="Taxes",
        compute='_compute_tax_ids',
        readonly=False,
        check_company=True)

    ewaybill_price_subtotal = fields.Monetary(
        string="Subtotal",
        compute='_compute_amount', readonly=True,
        currency_field='ewaybill_company_currency_id')

    ewaybill_price_total = fields.Monetary(
        string="Total",
        compute='_compute_amount', readonly=True,
        currency_field='ewaybill_company_currency_id')

    @api.depends('product_id', 'product_uom', 'quantity')
    def _compute_ewaybill_price_unit(self):
        for line in self:
            line.ewaybill_price_unit = line.product_id.with_company(line.company_id).standard_price

    @api.depends('product_id', 'product_uom')
    def _compute_tax_ids(self):
        for line in self:
            company_domain = self.env['account.tax']._check_company_domain(self.company_id)
            tax = False
            if line.product_id or not line.ewaybill_tax_ids:
                if line.picking_code == "incoming":
                    tax = line.product_id.supplier_taxes_id.filtered_domain(company_domain)
                else:
                    tax = line.product_id.taxes_id.filtered_domain(company_domain)

            fiscal_position = self.env.ref(f'account.{self.env.company.id}_fiscal_position_in_inter_state', raise_if_not_found=False)
            if fiscal_position and tax and line.ewaybill_id.transaction_type == "inter_state":
                line.ewaybill_tax_ids = fiscal_position.map_tax(tax)
            else:
                line.ewaybill_tax_ids = tax

    def _convert_to_tax_base_line_dict(self, **kwargs):
        """ Convert the current record to a dictionary in order to use the generic taxes computation method
        defined on account.tax.

        :return: A python dictionary.
        """
        self.ensure_one()
        return self.env['account.tax']._convert_to_tax_base_line_dict(
            self,
            currency=self.ewaybill_company_currency_id,
            product=self.product_id,
            taxes=self.ewaybill_tax_ids,
            price_unit=self.ewaybill_price_unit,
            quantity=self.quantity,
            price_subtotal=self.ewaybill_price_subtotal,
            **kwargs,
        )

    @api.depends('quantity', 'ewaybill_price_unit', 'ewaybill_tax_ids')
    def _compute_amount(self):
        for line in self:
            tax_results = self.env['account.tax']._compute_taxes([
                line._convert_to_tax_base_line_dict()
            ])
            totals = next(iter(tax_results['totals'].values()))
            amount_untaxed = totals['amount_untaxed']
            amount_tax = totals['amount_tax']

            line.update({
                'ewaybill_price_subtotal': amount_untaxed,
                'ewaybill_price_total': amount_untaxed + amount_tax,
            })
