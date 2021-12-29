# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class AccountMove(models.Model):
    _inherit = "account.move"

    amount_total_words = fields.Char("Total (In Words)", compute="_compute_amount_total_words")
    l10n_in_gst_treatment = fields.Selection([
            ('regular', 'Registered Business - Regular'),
            ('composition', 'Registered Business - Composition'),
            ('unregistered', 'Unregistered Business'),
            ('consumer', 'Consumer'),
            ('overseas', 'Overseas'),
            ('special_economic_zone', 'Special Economic Zone'),
            ('deemed_export', 'Deemed Export')
        ], string="GST Treatment", compute="_compute_l10n_in_gst_treatment", store=True, readonly=False)
    l10n_in_state_id = fields.Many2one('res.country.state', string="Place of supply", compute="_compute_l10n_in_state_id", store=True)
    l10n_in_gstin = fields.Char(string="GSTIN")
    # For Export invoice this data is need in GSTR report
    l10n_in_shipping_bill_number = fields.Char('Shipping bill number', readonly=True, states={'draft': [('readonly', False)]})
    l10n_in_shipping_bill_date = fields.Date('Shipping bill date', readonly=True, states={'draft': [('readonly', False)]})
    l10n_in_shipping_port_code_id = fields.Many2one('l10n_in.port.code', 'Port code', states={'draft': [('readonly', False)]})
    l10n_in_reseller_partner_id = fields.Many2one('res.partner', 'Reseller', domain=[('vat', '!=', False)], help="Only Registered Reseller", readonly=True, states={'draft': [('readonly', False)]})

    @api.depends('amount_total')
    def _compute_amount_total_words(self):
        for invoice in self:
            invoice.amount_total_words = invoice.currency_id.amount_to_text(invoice.amount_total)

    @api.depends('partner_id')
    def _compute_l10n_in_gst_treatment(self):
        for record in self:
            record.l10n_in_gst_treatment = record.partner_id.l10n_in_gst_treatment

    @api.depends('partner_id')
    def _compute_l10n_in_state_id(self):
        for move in self:
            if move.country_code == 'IN':
                country_code = move.partner_id.country_id.code
                if country_code == 'IN':
                    move.l10n_in_state_id = move.partner_id.state_id
                if country_code:
                    move.l10n_in_state_id = self.env('l10n_in.state_in_oc')
                else:
                    move.l10n_in_state_id = move.company_id.state_id
            else:
                move.l10n_in_state_id = False

    @api.model
    def _get_tax_grouping_key_from_tax_line(self, tax_line):
        # OVERRIDE to group taxes also by product.
        res = super()._get_tax_grouping_key_from_tax_line(tax_line)
        if tax_line.move_id.journal_id.company_id.account_fiscal_country_id.code == 'IN':
            res['product_id'] = tax_line.product_id.id
            res['product_uom_id'] = tax_line.product_uom_id.id
        return res

    @api.model
    def _get_tax_grouping_key_from_base_line(self, base_line, tax_vals):
        # OVERRIDE to group taxes also by product.
        res = super()._get_tax_grouping_key_from_base_line(base_line, tax_vals)
        if base_line.move_id.journal_id.company_id.account_fiscal_country_id.code == 'IN':
            res['product_id'] = base_line.product_id.id
            res['product_uom_id'] = base_line.product_uom_id.id
        return res

    @api.model
    def _get_tax_key_for_group_add_base(self, line):
        # DEPRECATED: TO BE REMOVED IN MASTER
        tax_key = super(AccountMove, self)._get_tax_key_for_group_add_base(line)

        tax_key += [
            line.product_id.id,
            line.product_uom_id.id,
        ]
        return tax_key

    def _post(self, soft=True):
        """Use journal type to define document type because not miss state in any entry including POS entry"""
        posted = super()._post(soft)
        gst_treatment_name_mapping = {k: v for k, v in
                             self._fields['l10n_in_gst_treatment']._description_selection(self.env)}
        for move in posted.filtered(lambda m: m.country_code == 'IN'):
            """Check state is set in company/sub-unit"""
            company = move.journal_id.company_id
            if not company.state_id:
                raise ValidationError(_(
                    "State is missing from your company %(company_name)s (%(company_id)s).\nFirst set state in your company.",
                    company_name=company.name,
                    company_id=company.id
                ))

            move.l10n_in_gstin = move.partner_id.vat
            if not move.l10n_in_gstin and move.l10n_in_gst_treatment in ['regular', 'composition', 'special_economic_zone', 'deemed_export']:
                raise ValidationError(_(
                    "Partner %(partner_name)s (%(partner_id)s) GSTIN is required under GST Treatment %(name)s",
                    partner_name=move.partner_id.name,
                    partner_id=move.partner_id.id,
                    name=gst_treatment_name_mapping.get(move.l10n_in_gst_treatment)
                ))

            # still state is not set then assumed that transaction is local like PoS so set state of company unit
            if not move.l10n_in_state_id:
                move.l10n_in_state_id = move.company_id.state_id
        return posted
