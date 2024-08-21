from odoo import models, fields, api


class AccountMoveSend(models.TransientModel):
    _inherit = "account.move.send"

    l10n_jo_edi_is_visible = fields.Boolean(
        compute="_compute_l10n_jo_edi_is_visible",
        help="Jordan: technical field to determine if the option to submit a Jordanian electronic invoice is visible.",
    )
    l10n_jo_edi_is_enabled = fields.Boolean(
        string="Send JoFotara e-invoice",
        compute="_compute_l10n_jo_edi_is_enabled",
        store=True,
        readonly=False,
        help="Jordan: used to determine whether to submit this e-invoice.",
    )

    @api.depends("move_ids")
    def _compute_l10n_jo_edi_is_visible(self):
        for wizard in self:
            wizard.l10n_jo_edi_is_visible = any(move.l10n_jo_edi_is_needed and move.l10n_jo_edi_state == 'to_send' for move in wizard.move_ids)

    @api.depends("l10n_jo_edi_is_visible")
    def _compute_l10n_jo_edi_is_enabled(self):
        for wizard in self:
            wizard.l10n_jo_edi_is_enabled = wizard.l10n_jo_edi_is_visible

    def _get_wizard_values(self):
        # EXTENDS 'account'
        res = super()._get_wizard_values()
        res["l10n_jo_edi_is_enabled"] = self.l10n_jo_edi_is_enabled
        return res

    @api.model
    def _get_wizard_vals_restrict_to(self, only_options):
        # EXTENDS 'account'
        values = super()._get_wizard_vals_restrict_to(only_options)
        return {
            'l10n_jo_edi_is_enabled': False,
            **values,
        }

    def _call_web_service_before_invoice_pdf_render(self, invoices_data):
        # EXTENDS 'account'
        super()._call_web_service_before_invoice_pdf_render(invoices_data)
        for invoice, invoice_data in invoices_data.items():
            # Not all invoices may need EDI.
            if not invoice_data.get("l10n_jo_edi_is_enabled") or not invoice.l10n_jo_edi_is_needed:
                continue

            if error := invoice.with_company(invoice.company_id)._l10n_jo_edi_send():
                invoice_data["error"] = error

            if self._can_commit():
                self._cr.commit()
