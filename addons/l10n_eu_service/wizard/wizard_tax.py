# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import Warning


class l10n_eu_service_tax(models.TransientModel):
    """Proposes taxes to create in the wizard"""
    _name = 'l10n_eu_service.wizard.tax'
    _description = __doc__

    name = fields.Char('Fiscal Position', compute='_compute_fiscal_position_details')
    map_tax_id = fields.Many2one('account.tax', string='Tax on Product', readonly=True)
    apply_tax_id = fields.Char(string='Tax to apply', compute='_compute_fiscal_position_details')
    country_id = fields.Many2one('res.country', readonly=True)
    amount = fields.Float('Rate')
    # fiscal_position_exists = fields.Boolean(compute='_compute_fiscal_position_details')
    # tax_exists = fields.Boolean(compute='_compute_fiscal_position_details')
    account_collected_id = fields.Many2one("account.account")

    @api.depends('map_tax_id', 'country_id', 'amount')
    def _compute_fiscal_position_details(self):
        existing_fps = self.env['account.fiscal.position'].search([('country_id', 'in', self.country_id.mapped('id'))])
        tax = self.env['account.tax']
        for record in self:
            existing_fp = existing_fps.filtered(lambda fp: fp.country_id == record.country_id);
            # record.fiscal_position_exists = bool(len(existing_fp))
            record.name = existing_fp.name or _('OSS B2C %(country)s' % {'country': record.country_id.name})
            record.apply_tax_id = _('%(label)s in %(country)s (%(rate)s)' % {'label': record.country_id.vat_label, 'country': record.country_id.name, 'rate':record.amount})
            # record.tax_exists = bool(len(tax.search([('name', '=', record.apply_tax_id)])))
