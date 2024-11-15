from lxml import etree

from odoo import api, fields, models


class L10nEsEdiVerifactuDocument(models.Model):
    _name = 'l10n_es_edi_verifactu.document'
    _description = "Document object representing a Veri*Factu XML"
    _order = 'datetime DESC, id DESC'

    move_id = fields.Many2one(comodel_name='account.move', required=True)
    state = fields.Selection(
        selection=[
            ('invoice_sending', 'Sent'),
            ('invoice_sending_failed', 'Error'),
            ('invoice_accepted', 'Validated'),
        ],
        string='E-Factura Status',
        required=True,
        help="""Sent -> Successfully sent to the AEAT, waiting for validation.
                Validated -> Sent & validated by the AEAT.
                Error -> Sending error or validation error from the AEAT.""",
    )
    datetime = fields.Datetime(default=fields.Datetime.now, required=True)
    attachment_id = fields.Many2one(comodel_name='ir.attachment')
    message = fields.Char()

    @api.model
    def _create_document(self, xml, move, state):
        move.ensure_one()
        root = etree.fromstring(xml)
        # create document; TODO: missing values
        doc = self.create({
            'move_id': move.id,
            'state': state,
        })
        # create attachment
        attachment = self.env['ir.attachment'].create({
            'raw': xml.encode(),  # TODO:
            'name': self.env['account.edi.xml.verifactu']._export_invoice_filename(move),
            'res_id': doc.id if state != 'invoice_accepted' else move.id,
            'res_model': doc._name if state != 'invoice_accepted' else move._name,
        })
        doc.attachment_id = attachment  # TODO: ?: create when creating document
        return doc

    @api.model
    def _build_soap_request_xml(self, values):
        return self.env['ir.qweb']._render('l10n_es_edi_verifactu.soap_request_verifactu', values)

    @api.model
    def _send_to_aeat(self, move, edi_xml):
        values = {
            'edi_xml': edi_xml,
        }
        request_xml = self._build_soap_request_xml(values)
        # TODO: request and answer
        document = self._create_document(edi_xml, move, 'invoice_accepted')
        # TODO: error handling
        return {'error': None, 'document': document}
