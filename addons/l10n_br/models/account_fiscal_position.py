# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models

SOUTH_SOUTHEAST = {"PR", "RS", "SC", "SP", "ES", "MG", "RJ"}
NORTH_NORTHEAST_MIDWEST = {
    "AC", "AP", "AM", "PA", "RO", "RR", "TO", "AL", "BA", "CE",
    "MA", "PB", "PE", "PI", "RN", "SE", "DF", "GO", "MT", "MS"
}


class AccountFiscalPosition(models.Model):
    _inherit = 'account.fiscal.position'

    l10n_br_fp_type = fields.Selection(
        selection=[
            ('internal', 'Internal'),
            ('ss_nnm', 'South/Southeast selling to North/Northeast/Midwest'),
            ('interstate', 'Other interstate'),
        ],
        string='Interstate Fiscal Position Type',
    )

    def _get_fpos_ranking_functions(self, partner):
        def ranking_function(fpos):
            company = fpos.company_id
            company_in_sse = company.state_id.code in SOUTH_SOUTHEAST
            partner_in_sse = partner.state_id.code in SOUTH_SOUTHEAST
            include_fp = True  # by default, include this fp without preference

            if (fpos.l10n_br_fp_type == 'internal' and company.state_id != partner.state_id) or (
                fpos.l10n_br_fp_type == 'ss_nnm' and (not company_in_sse or partner_in_sse)
            ):
                include_fp = False

            return include_fp

        return [
            (
                'l10n_br_fp_type',
                ranking_function,
            )
        ] + super()._get_fpos_ranking_functions(partner)
