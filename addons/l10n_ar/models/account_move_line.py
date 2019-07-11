# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models, fields, api, _
from odoo.exceptions import UserError


class AccountMoveLine(models.Model):

    _inherit = 'account.move.line'

    l10n_ar_afip_responsability_type_id = fields.Many2one(related='move_id.l10n_ar_afip_responsability_type_id')
    l10n_ar_vat_tax_id = fields.Many2one(
        'account.tax', compute='_compute_l10n_ar_vat_tax_id', string='VAT Tax', help="Technical Field. Helper.")

    @api.depends('tax_ids.tax_group_id.l10n_ar_type', 'tax_ids.tax_group_id.l10n_ar_tax')
    def _compute_l10n_ar_vat_tax_id(self):
        for rec in self:
            l10n_ar_vat_tax_id = rec.tax_ids.filtered(lambda x: (
                x.tax_group_id.l10n_ar_type == 'tax' and x.tax_group_id.l10n_ar_tax == 'vat'))
            if len(l10n_ar_vat_tax_id) > 1:
                raise UserError(_('Only one vat tax allowed per line'))
            rec.l10n_ar_vat_tax_id = l10n_ar_vat_tax_id
