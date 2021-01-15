# -*- coding: utf-8 -*-
from odoo import api, fields, models, _


class AccountTaxDetail(models.Model):
    _name = "account.tax.detail"
    _description = "Tax Detail"

    line_id = fields.Many2one(
        comodel_name='account.move.line',
        string="Source line of taxes",
        required=True,
        readonly=True,
        ondelete='cascade')
    account_id = fields.Many2one(
        comodel_name='account.account',
        string="Account",
        required=True,
        ondelete='cascade',
        domain="[('deprecated', '=', False)]")
    tax_amount = fields.Float(string="Tax Amount")
    tax_amount_currency = fields.Float(string="Tax Amount in Foreign Currency")
    tax_base_amount = fields.Monetary(
        string="Tax Base Amount",
        currency_field='company_currency_id')
    tax_base_amount_currency = fields.Monetary(
        string="Tax Base Amount in Foreign Currency",
        currency_field='currency_id')
    tax_ids = fields.Many2many(
        comodel_name='account.tax',
        string="Taxes",
        help="Taxes that apply on the base amount")
    tag_ids = fields.Many2many(
        comodel_name='account.account.tag',
        string="Tax Grids",
        help="Tags assigned to this line by the tax creating it, if any. It determines its impact on financial reports.")
    tax_repartition_line_id = fields.Many2one(
        comodel_name='account.tax.repartition.line',
        string="Originator Tax Distribution Line",
        required=True,
        ondelete='cascade',
        help="Tax distribution line that caused the creation of this move line, if any")
    tax_id = fields.Many2one(
        comodel_name='account.tax',
        string="Originator Tax",
        required=True,
        ondelete='cascade',
        help="The tax that has generated this tax detail. It could be a group of taxes.")

    currency_id = fields.Many2one(related='line_id.currency_id')
    company_currency_id = fields.Many2one(related='line_id.company_currency_id')
