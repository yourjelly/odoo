from odoo import api, models, fields, _
from odoo.exceptions import ValidationError


class ResPartner(models.Model):
    _inherit = 'res.partner'

    l10n_rs_edi_registration_number = fields.Char(
        string="Registration Number",
        help="Company ID ( Matični Broj ) assigned by the Serbian Business Registers Agency (APR) ",
        size=13,
    )
    l10n_rs_edi_public_funds_id = fields.Char(
        string="JBKJS",
        help="Unique Identifier of Public Funds Users ( Jedinstveni Identifikator Korisnika Javnih Sredstava ) such as Government agencies, public institutions and state-owned enterprises.",
        size=5,
    )

    @api.constrains('l10n_rs_edi_public_funds_id')
    def _check_l10n_rs_edi_public_funds_id(self):
        for record in self:
            if record.l10n_rs_edi_public_funds_id and \
                (len(record.l10n_rs_edi_public_funds_id) < 5 or not record.l10n_rs_edi_public_funds_id.isdigit()):
                raise ValidationError(_('Public Funds ID(JBKJS) must be exactly five digits'))

    @api.constrains('l10n_rs_edi_registration_number')
    def _check_registeration_id_in_rs(self):
        for record in self:
            if record.l10n_rs_edi_registration_number and \
                (len(record.l10n_rs_edi_registration_number) not in [8, 13] or not record.l10n_rs_edi_registration_number.isdigit()):
                raise ValidationError(_('Customer identification number should be 8 or 13 digits'))
