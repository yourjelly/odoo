import re

from odoo import api, fields, models, _


class AccountMove(models.Model):
    _inherit = 'account.move'

    l10n_es_edi_verifactu_document_ids = fields.One2many(
        comodel_name='l10n_es_edi_verifactu.document',
        inverse_name='move_id',
    )
    l10n_es_edi_verifactu_state = fields.Selection(
        selection=[
            ('invoice_sending', 'Sent'),
            ('invoice_sent', 'Validated'),
        ],
        string='E-Factura Status',
        compute='_compute_l10n_es_edi_verifactu_state',
        store=True,
        help="""- Sent: Successfully sent to the AEAT, waiting for validation
                - Validated: Sent & validated by the AEAT
                - Error: Sending error or validation error from the AEAT""",
    )
    l10n_es_edi_verifactu_attachment_id = fields.Many2one(comodel_name='ir.attachment')

    ################################################################################
    # Compute Methods
    ################################################################################

    @api.depends('l10n_es_edi_verifactu_document_ids')
    def _compute_l10n_es_edi_verifactu_state(self):
        self.l10n_es_edi_verifactu_state = False
        for move in self:
            for document in move.l10n_es_edi_verifactu_document_ids.sorted():
                if document.state in ('invoice_sending', 'invoice_sent'):
                    move.l10n_es_edi_verifactu_state = document.state
                    break

    @api.depends('l10n_es_edi_verifactu_state')
    def _compute_show_reset_to_draft_button(self):
        """ Prevent user to reset move to draft when there's an
            active sending document or a successful response has been received """
        # EXTENDS 'account'
        super()._compute_show_reset_to_draft_button()
        for move in self:
            if move.l10n_es_edi_verifactu_state in ('invoice_sending', 'invoice_sent'):
                move.show_reset_to_draft_button = False

    ################################################################################
    # Document Shorthands & Helpers
    ################################################################################

    def _l10n_es_edi_verifactu_create_attachment_values(self, raw, res_model=None, res_id=None):
        """ Shorthand for creating the attachment_id values on the invoice's document """
        self.ensure_one()
        res_model = res_model or self._name
        res_id = res_id or self.id
        return {
            'name': f"verifactu_signature_{self.name.replace('/', '_')}.xml",
            'res_model': res_model,
            'res_id': res_id,
            'raw': raw,
            'type': 'binary',
            'mimetype': 'application/xml',
        }

    def _l10n_es_edi_verifactu_get_attachment_file_name(self):
        self.ensure_one()
        sanitized_name = re.sub(r'[\W_]', '', self.name)  # remove non-word char or underscores
        return f"verifactu_{sanitized_name}.xml"

    ################################################################################
    # Sending-related Functions
    ################################################################################

    def _l10n_es_edi_verifactu_get_pre_send_errors(self, xml_data='', assert_xml=False):
        """ Compute all possible common errors before sending the XML to the SPV """
        self.ensure_one()
        errors = []
        if not xml_data and assert_xml:
            errors.append(_('Veri*Factu XML attachment not found.'))
        return errors

    def _l10n_es_edi_verifactu_send_invoice(self, edi_xml):
        """
        # TODO:
        :param xml_data: string of the xml data to be sent
        """
        self.ensure_one()
        if errors := self._l10n_es_edi_verifactu_get_pre_send_errors(edi_xml, assert_xml=True):
            # TODO: ?: unlink previous fails
            # TODO: create document for fail
            return

        # TODO: unlink previous rejected
        self.env['res.company']._with_locked_records(self)
        info = self.env['l10n_es_edi_verifactu.document']._send_to_aeat(self, edi_xml)
        document = info['document']

        if document.state == 'invoice_accepted':
            self.with_context(no_new_invoice=True).message_post(
                body=_("The Veri*Factu document was accepted by the AEAT."),
                attachment_ids=document.attachment_id.copy().ids,
            )
        # TODO: ?: unlink fails? if accepted

        return document
