# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class ResPartner(models.Model):
    _inherit = 'res.partner'

    l10n_it_edi_doi_is_regular_exporter = fields.Boolean(
        string='Is Regular Exporter',
        default=False,
        help="Enable this checkbox to specify a Declaration of Intent on this partner which is then considered a Regular Exporter"
    )

    l10n_it_edi_doi_declaration_of_intent_ids = fields.One2many(
        'l10n_it_edi_doi.declaration_of_intent',
        'partner_id',
        string="Available Declarations of Intent of this partner",
        domain=lambda self: [('company_id', '=', self.env.company.id)],
    )

    @api.constrains('l10n_it_edi_doi_is_regular_exporter')
    def _check_l10n_it_edi_doi_is_regular_exporter(self):
        for partner in self:
            if partner.l10n_it_edi_doi_is_regular_exporter:
                return
            active_declarations = partner.l10n_it_edi_doi_declaration_of_intent_ids.filtered(
                lambda declaration: declaration.state == 'active'
            )
            if active_declarations:
                raise UserError(_("Partners with active Declarations of Intent are regular exporters."))

    def l10n_it_edi_doi_action_open_declarations(self):
        self.ensure_one()
        return {
            'name': _("Declaration of Intent of %s", self.display_name),
            'type': 'ir.actions.act_window',
            'res_model': 'l10n_it_edi_doi.declaration_of_intent',
            'domain': [('partner_id', '=', self.commercial_partner_id.id)],
            'views': [(self.env.ref('l10n_it_edi_doi.view_l10n_it_edi_doi_declaration_of_intent_tree').id, 'tree'),
                      (self.env.ref('l10n_it_edi_doi.view_l10n_it_edi_doi_declaration_of_intent_form').id, 'form')],
            'context': {
                'default_partner_id': self.id,
            },
        }


class AccountFiscalPosition(models.Model):
    _inherit = 'account.fiscal.position'

    @api.ondelete(at_uninstall=False)
    def _never_unlink_declaration_of_intent_fiscal_position(self):
        for company_id, positions in self.grouped('company_id').items():
            declaration_position = company_id.l10n_it_edi_doi_declaration_of_intent_fiscal_position
            if declaration_position in positions:
                raise UserError(_('You cannot delete the special fiscal position for Declarations of Intent.'))
