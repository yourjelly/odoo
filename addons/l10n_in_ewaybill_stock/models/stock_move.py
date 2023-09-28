# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class StockMove(models.Model):
    _inherit = "stock.move"
    _description = "Stock Move Ewaybill"

    ewaybill_id = fields.Many2one(
        comodel_name='l10n.in.ewaybill',
        required=True)

    currency_id = fields.Many2one(
        comodel_name='res.currency',
        related='company_id.currency_id', store=True, readonly=True)

    price_unit = fields.Float(
        string="Unit Price",
        compute='_compute_price_unit',
        digits='Product Price', store=True, readonly=False)

    ewaybill_tax_ids = fields.Many2many(
        comodel_name='account.tax',
        string="Taxes",
        compute='_compute_tax_ids',
        store=True, readonly=False,
        check_company=True)

    ewaybill_price_subtotal = fields.Monetary(
        string="Subtotal",
        compute='_compute_amount', readonly=True,
        store=True)

    ewaybill_price_total = fields.Monetary(
        string="Total",
        compute='_compute_amount', readonly=True,
        store=True)

    @api.depends('product_id', 'product_uom', 'quantity_done')
    def _compute_price_unit(self):
        for line in self:
            if line.picking_code == "outgoing":
                line.price_unit = line.product_id.list_price
            elif line.picking_code == "incoming":
                line.price_unit = line.product_id.standard_price
            else:
                line.price_unit = 0

    @api.depends('product_id', 'product_uom')
    def _compute_tax_ids(self):
        for line in self:
            company_domain = self.env['account.tax']._check_company_domain(self.company_id)
            if line.product_id or not line.ewaybill_tax_ids:
                if line.picking_code == "outgoing":
                    line.ewaybill_tax_ids = line.product_id.taxes_id.filtered_domain(company_domain)
                elif line.picking_code == "incoming":
                    line.ewaybill_tax_ids = line.product_id.supplier_taxes_id.filtered_domain(company_domain)
                else:
                    line.ewaybill_tax_ids = False

    def _convert_to_tax_base_line_dict(self, **kwargs):
        """ Convert the current record to a dictionary in order to use the generic taxes computation method
        defined on account.tax.

        :return: A python dictionary.
        """
        self.ensure_one()
        return self.env['account.tax']._convert_to_tax_base_line_dict(
            self,
            currency=self.currency_id,
            product=self.product_id,
            taxes=self.ewaybill_tax_ids,
            price_unit=self.price_unit,
            quantity=self.quantity_done,
            price_subtotal=self.ewaybill_price_subtotal,
            **kwargs,
        )

    @api.depends('quantity_done', 'price_unit', 'ewaybill_tax_ids')
    def _compute_amount(self):
        for line in self:
            tax_results = self.env['account.tax']._compute_taxes([
                line._convert_to_tax_base_line_dict()
            ])
            totals = list(tax_results['totals'].values())[0]
            amount_untaxed = totals['amount_untaxed']
            amount_tax = totals['amount_tax']

            line.update({
                'ewaybill_price_subtotal': amount_untaxed,
                'ewaybill_price_total': amount_untaxed + amount_tax,
            })
