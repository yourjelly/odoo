from odoo import fields, models, api, _
from odoo.exceptions import ValidationError
from odoo.addons.l10n_at_pos.tools import at_fiskaly_services

STATE = {
    "opened": "INITIALIZED",
    "opening_control": "",
    "closed": "DECOMMISSIONED",
    "closing_control": "",
}

class PosSession(models.Model):
    _inherit = ['pos.session']

    l10n_at_pos_session_uuid = fields.Char(string="Fiskaly session UUID", readonly=True, copy=False)
    l10n_at_pos_signature_creation_uuid = fields.Char(string="Fiskaly scu UUID", readonly=True, copy=False)

    @api.model
    def _load_pos_data_fields(self, config_id):
        fields = super()._load_pos_data_fields(config_id)
        fields += ["l10n_at_pos_session_uuid"]
        return fields

    @api.model_create_multi
    def create(self, vals_list):
        sessions = super().create(vals_list)
        for session in sessions:
            if session.company_id.l10n_at_fiskaly_access_tocken:
                # Authenticate FON first
                if not session.company_id.is_fon_authenticated:
                    raise ValidationError(_("Please first authenticate your company with FON."))

                # If no opened session means no scu initiakized
                domain = [
                    ('state', '!=', 'closed'),
                    ('config_id', '!=', int(self.config_id)),
                ]
                current_company_sessions = self.env['pos.session'].search(domain)
                # For each session first create a SCU for encrypted transaction signing
                if len(current_company_sessions) == 1: # first session
                    session.l10n_at_pos_signature_creation_uuid = at_fiskaly_services.generate_custom_uuidv4()
                    at_fiskaly_services._create_scu(session.company_id, session.l10n_at_pos_signature_creation_uuid)
                else:
                    # Just set the running SCU to use that
                    session.l10n_at_pos_signature_creation_uuid = current_company_sessions[0].l10n_at_pos_signature_creation_uuid

                # Now create the session on fiskaly
                session.l10n_at_pos_session_uuid = at_fiskaly_services.generate_custom_uuidv4()
                at_fiskaly_services._create_register(session, session.l10n_at_pos_session_uuid)
        return sessions

    def write(self, vals):
        sessions = super().write(vals)
        if self.company_id.l10n_at_fiskaly_access_tocken and 'state' in vals:
            new_state = STATE[vals['state']]
            domain = [
                    ('state', 'in', ['opening_control', 'opened']),
                    ('config_id', '!=', int(self.config_id)),
                ]
            current_company_sessions = self.env['pos.session'].search(domain)
            if new_state:
                if new_state != "DECOMMISSIONED": #current one session only
                    at_fiskaly_services.scu_state_update(self.company_id, new_state, self.l10n_at_pos_signature_creation_uuid)
                    at_fiskaly_services.cash_reg_state_update(self, new_state)
                elif not len(current_company_sessions):
                    # check if all receipts are signed if not than make it outage instead of decommisioning
                    # which can be opened when we want to sign orders
                    sign_failed_orders = self.order_ids.filtered(lambda o: not o.is_fiskaly_order_receipt_signed)
                    if sign_failed_orders:
                        new_state = 'OUTAGE'
                    at_fiskaly_services.cash_reg_state_update(self, new_state)
                    at_fiskaly_services.scu_state_update(self.company_id, 'DECOMMISSIONED', self.l10n_at_pos_signature_creation_uuid)
                else:
                    at_fiskaly_services.cash_reg_state_update(self, new_state)
        return sessions

class ReportL10n_At_PosReport_Session_Audit_Template(models.AbstractModel):
    _name = 'report.l10n_at_pos.report_session_audit_template'
    _description = 'Get DEP7 Report for Session.'

    @api.model
    def _get_report_values(self, docids, data=None):
        return {
            'data' : data,
            'docs' : self.env['res.company'].browse(self.env.company.id),
        }