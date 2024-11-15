from odoo import api, fields, models, _


class AccountMoveSend(models.TransientModel):
    _inherit = 'account.move.send'

    l10n_es_edi_verifactu_send_enable = fields.Boolean(compute='_compute_l10n_es_edi_verifactu_send_enable')
    l10n_es_edi_verifactu_send_readonly = fields.Boolean(compute='_compute_l10n_es_edi_verifactu_send_readonly')
    l10n_es_edi_verifactu_send_checkbox = fields.Boolean(
        string="Veri*Factu",
        compute='_compute_l10n_es_edi_verifactu_send_checkbox', store=True, readonly=False,
        help="TODO:")
    l10n_es_edi_verifactu_warnings = fields.Char(compute='_compute_l10n_es_edi_verifactu_warnings')  # TODO: remove in saas-17.4

    def _get_wizard_values(self):
        # EXTENDS 'account'
        values = super()._get_wizard_values()
        values['l10n_es_edi_verifactu_send'] = self.l10n_es_edi_verifactu_send_checkbox
        return values

    @api.depends('move_ids.l10n_es_edi_verifactu_state', 'enable_ubl_cii_xml')
    def _compute_l10n_es_edi_verifactu_send_enable(self):
        """ Enable sending in case any move's Verifactur EDI can be send."""
        for wizard in self:
            wizard.l10n_es_edi_verifactu_send_enable = any(
                move.country_code == 'ES' and
                move.l10n_es_edi_verifactu_state in (False, 'invoice_sending')
                for move in wizard.move_ids
            )

    @api.depends('move_ids.l10n_es_edi_verifactu_state', 'l10n_es_edi_verifactu_send_enable')
    def _compute_l10n_es_edi_verifactu_send_readonly(self):
        """ We shouldn't allow the user to send a new request if any move is currently waiting for an answer. """
        for wizard in self:
            wizard.l10n_es_edi_verifactu_send_readonly = (
                not wizard.l10n_es_edi_verifactu_send_enable
                or 'invoice_sending' in wizard.move_ids.mapped('l10n_es_edi_verifactu_state')
            )

    @api.depends('l10n_es_edi_verifactu_send_readonly')
    def _compute_l10n_es_edi_verifactu_send_checkbox(self):
        for wizard in self:
            wizard.l10n_es_edi_verifactu_send_checkbox = not wizard.l10n_es_edi_verifactu_send_readonly

    @api.depends('l10n_es_edi_verifactu_send_readonly')
    def _compute_l10n_es_edi_verifactu_warnings(self):
        """ TODO: in saas-17.4: merge it with `warnings` field using `_compute_warnings`. """
        for wizard in self:
            waiting_moves = wizard.move_ids.filtered(lambda m: m.l10n_es_edi_verifactu_state == 'invoice_sending')
            wizard.l10n_es_edi_verifactu_warnings = _(
                "The following move(s) are waiting for answer from the Romanian SPV: %s",
                ', '.join(waiting_moves.mapped('name'))
            ) if waiting_moves else False

    @api.model
    def _call_web_service_after_invoice_pdf_render(self, invoices_data):
        # EXTENDS 'account'
        super()._call_web_service_after_invoice_pdf_render(invoices_data)

        for invoice, invoice_data in invoices_data.items():
            # TODO: also block when invoice.l10n_l10n_es_edi_verifactu_state
            if invoice_data.get('l10n_es_edi_verifactu_send'):
                # Render
                edi_xml, errors = self.env['account.edi.xml.verifactu']._export_invoice(invoice)  # TODO:
                if errors:
                    invoice_data['error'] = {
                        'error_title': _("Error when rebuilding the Veri*Factu document"),
                        'errors': errors,
                    }
                    continue

                # TODO: unlink rejected documents

                document = invoice._l10n_es_edi_verifactu_send_invoice(edi_xml)

                if document.state in ('invoice_rejected', 'invoice_sending_failed'):
                    invoice_data['error'] = {
                        'error_title': _("Error(s) when sending the Veri*Factu document to the AEAT:"),
                        'errors': document.message_json.get('errors') or [document.message_json['status']],
                    }
                # TODO:
                # elif document.state == 'invoice_accepted':
                #     # TODO: for DIAN; we call DIAN again to verify
                #     invoice_data['l10n_es_verifactu_attached_document'] = self.env['ir.attachment'].create({
                #         'raw': document,
                #         'name': invoice._l10n_es_edi_verifactu_get_attachment_file_name(),
                #         'res_model': 'account.move',
                #         'res_id': invoice.id,
                #     })
                # TODO: other cases of state?

                if self._can_commit():
                    self._cr.commit()
