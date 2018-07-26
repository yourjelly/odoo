# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    l10n_in_multi_gstin_numbers = fields.Boolean(related="company_id.l10n_in_multi_gstin_numbers", string="Multiple GSTIN registered")
    show_module_l10n_in = fields.Boolean(compute='_compute_show_module_l10n_in')

    @api.depends('company_id')
    def _compute_show_module_l10n_in(self):
        self.show_module_l10n_in = self.company_id.country_id.code == 'IN'

    @api.multi
    def set_values(self):
        """update created company partner in l10n_in_gstin_partner_ids relation.
        For use in domain of l10n_in_gstin_partner_id"""
        super(ResConfigSettings, self).set_values()
        if self.l10n_in_multi_gstin_numbers:
            self.env.user.write({'groups_id': [(4, self.env.ref('l10n_in.group_l10n_in_multi_gstin').id)]})
            self.company_id.partner_id.l10n_in_gstin_company_id = self.company_id
