from odoo import models, fields, _, api
from odoo.addons.l10n_at_pos.tools import at_fiskaly_services
from odoo.exceptions import UserError

class ResCompany(models.Model):
    _inherit = ['res.company']

    l10n_at_fiskaly_api_key = fields.Char(string="Fiskaly API Key", groups="base.group_erp_manager")
    l10n_at_fiskaly_api_secret = fields.Char(string="Fiskaly API Secret", groups="base.group_erp_manager")
    l10n_at_fiskaly_organization_id = fields.Char(string="Fiskaly Organization ID")
    l10n_at_fiskaly_access_tocken = fields.Char(string="Fiskaly Access Tocken")
    l10n_at_monthly_receipt_validation = fields.Boolean(string="Monthly Validation", default=False)
    l10n_at_yearly_receipt_validation = fields.Boolean(string="Yearly Validation", default=False)
    l10n_at_fon_participan_id = fields.Char(string="FON Participation id")
    l10n_at_fon_user_id = fields.Char(string="FON User id")
    l10n_at_fon_user_pin = fields.Char(string="FON User pin")
    is_country_austria = fields.Boolean(string="Company located in Austria", compute='_compute_is_country_austria')
    is_fon_authenticated = fields.Boolean(string="Company authenticated with FON", default=False)

    @api.model
    def _load_pos_data_fields(self, config_id):
        fields = super()._load_pos_data_fields(config_id)
        fields += ["l10n_at_fiskaly_access_tocken"]
        return fields

    @api.depends('country_id')
    def _compute_is_country_austria(self):
        for company in self:
            company.is_country_austria = company.country_id.code == 'AT'

    def write(self, vals):
        company = super().write(vals)
        # Pre check to avoid unnecessary api calls
        if 'l10n_at_fon_participan_id' in vals:
            if len(self.l10n_at_fon_participan_id) < 8:
                raise UserError(("FON participation id should NOT be shorter than 8 characters, please enter correct participation id"))
        if 'l10n_at_fon_user_id' in vals:
            if len(self.l10n_at_fon_user_id) < 5:
                raise UserError(("FON user id should NOT be shorter than 5 characters, please enter correct user id"))
        if 'l10n_at_fon_user_pin' in vals:
            if len(self.l10n_at_fon_user_id) < 5:
                raise UserError(("FON user id should NOT be shorter than 5 characters, please verify your pin"))

        # Organization configuration update
        at_fiskaly_services.organization_config_updates(self, vals)
        return company

    def l10n_at_action_authenticate_keys(self):
        if self.l10n_at_fiskaly_api_key and self.l10n_at_fiskaly_api_secret:
            response = at_fiskaly_services._authenticate_fiskaly_credentials(self)
            if response.status_code != 200:
                raise UserError(_("Authentication failed."))
        else:
            raise UserError(_("Please fill all fiskaly api credentials before authenticating."))

    def l10n_at_action_authenticate_fon(self):
        at_fiskaly_services._authenticate_fon_credentials(self)
