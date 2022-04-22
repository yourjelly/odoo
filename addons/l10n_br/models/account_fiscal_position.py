# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models

SOUTH_SOUTHEAST = {"PR", "RS", "SC", "SP", "ES", "MG", "RJ"}
NORTH_NORTHEAST_MIDWEST = {"AC", "AP", "AM", "PA", "RO", "RR", "TO",
                           "AL", "BA", "CE", "MA", "PB", "PE", "PI",
                           "RN", "SE", "SP", "DF", "GO", "MT", "MS"
                           }


class AccountFiscalPosition(models.Model):

    _inherit = 'account.fiscal.position'

    l10n_br_fp_type = fields.Selection([
        ('internal', 'Internal'),
        ('ss_nnm', 'South/Southeast selling to North/Northeast/Midwest'),
        ('interstate', 'Other interstate'),
    ], string='Interstate Fiscal Position Type')

    @api.model
    def _get_fiscal_position(self, partner, delivery=None):
        if self.env.company.country_id.code != "BR":
            return super()._get_fiscal_position(partner, delivery=delivery)

        if not delivery:
            delivery = partner

        # manually set fiscal position on partner has a higher priority
        manual_fiscal_position = delivery.property_account_position_id or partner.property_account_position_id
        if manual_fiscal_position:
            return manual_fiscal_position

        # Taxation in Brazil depends on both the state of the partner and the state of the company
        if partner.country_id.code == 'BR':
            if self.env.company.state_id == partner.state_id:
                return self.search([('l10n_br_fp_type', '=', 'internal')], limit=1)
            elif self.env.company.state_id.code in SOUTH_SOUTHEAST and partner.state_id.code in NORTH_NORTHEAST_MIDWEST:
                return self.search([('l10n_br_fp_type', '=', 'ss_nnm')], limit=1)
            else:
                return self.search([('l10n_br_fp_type', '=', 'interstate')], limit=1)
        else:
            return super()._get_fiscal_position(partner, delivery=delivery)
