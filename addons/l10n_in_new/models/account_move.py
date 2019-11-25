# -*- coding: utf-8 -*-

from odoo import models, fields, api
from odoo.exceptions import ValidationError

class AccountJournal(models.Model):
    _inherit = "account.move"

    l10n_in_gst_treatment = fields.Selection([
        ('regular','Registered Business - Regular'),
        ('composition','Registered Business - Composition'),
        ('unregistered','Unregistered Business'),
        ('consumer','Consumer'),
        ('overseas','Overseas'),
        ('special_economic_zone','Special Economic Zone'),
        ('deemed_export','Deemed Export'),
        ],string="GST Treatment", readonly=True, states={'draft': [('readonly', False)]})
    l10n_in_place_of_supply_id = fields.Many2one('res.country.state', string="Place of Supply", domain=[('l10n_in_tin','!=', False)], readonly=True, states={'draft': [('readonly', False)]})
    l10n_in_company_country_code = fields.Char(related='company_id.country_id.code', string="Country code")
    l10n_in_gstin = fields.Char(string="GSTIN", readonly=True, states={'draft': [('readonly', False)]})

    @api.constrains('l10n_in_gst_treatment','journal_id','partner_id')
    def _check_l10n_in_gst_treatment(self):
        wrong_moves = self.filtered(lambda move:
            move.l10n_in_company_country_code == 'IN' and
            move.l10n_in_gst_treatment in ['regular','composition','special_economic_zone','deemed_export'] and
            move.partner_id.vat == False)
        if wrong_moves:
            partners_name = "".join("%s(%s) "%(m.partner_id.name,m.partner_id.id) for m in wrong_moves)
            raise ValidationError(_("GSTIN is required for GST Treatment Regular, Composition, Special Economic Zone and Deemed Export.\nDefine GSTIN in %s") %(partners_name))

    @api.constrains('l10n_in_gstin', 'journal_id')
    def _check_l10n_in_gstin(self):
        moves = self.filtered(lambda move:
            move.l10n_in_company_country_code == 'IN' and
            move.l10n_in_gstin != False)
        check_vat_in = self.env['res.partner'].check_vat_in
        wrong_gstin = []
        for move in moves:
            if not check_vat_in(move.l10n_in_gstin):
                wrong_gstin.append(move.l10n_in_gstin)
        if wrong_gstin:
            raise ValidationError(_("GSTIN '%s' is not valid") %(",".join(wrong_gstin)))

    @api.onchange('partner_id')
    def _onchange_partner_id(self):
        if self.l10n_in_company_country_code == 'IN':
            self.l10n_in_gst_treatment = self.partner_id.l10n_in_gst_treatment
            if self.partner_id.l10n_in_gst_treatment in ('regular','composition','special_economic_zone','deemed_export'):
                l10n_in_place_of_supply_id = self.partner_id.l10n_in_place_of_supply_id
                if not l10n_in_place_of_supply_id and self.partner_id.state_id.l10n_in_tin:
                    l10n_in_place_of_supply_id = self.partner_id.state_id
                self.l10n_in_place_of_supply_id = l10n_in_place_of_supply_id
                self.l10n_in_gstin = self.partner_id.vat
            else:
                self.l10n_in_gstin = False
                self.l10n_in_place_of_supply_id = False
        return super()._onchange_partner_id()

    @api.onchange('journal_id')
    def _onchange_journal(self):
        if self.l10n_in_company_country_code != 'IN':
            self.l10n_in_gst_treatment = False
            self.l10n_in_place_of_supply_id = False
            self.l10n_in_gstin = False
        return super()._onchange_journal()
