import re

from odoo import api, models


class AccountEdiXmlVerifactu(models.AbstractModel):
    # TODO: docstring
    _name = 'account.edi.xml.verifactu'
    _description = "Verifactu EDI XML"

    # -------------------------------------------------------------------------
    # EXPORT
    # -------------------------------------------------------------------------

    @api.model
    def _export_invoice_filename(self, move):
        move.ensure_one()
        sanitized_name = re.sub(r'[\W_]', '', move.name)  # remove non-word char or underscores
        return f"verifactu_invoice_{sanitized_name}.xml"  # TODO:

    @api.model
    def _export_invoice_vals(self, invoice):
        # TODO: check for errors
        invoice.ensure_one()
        vals = {}
        errors = []
        return vals, errors

    @api.model
    def _export_invoice(self, invoice):
        invoice.ensure_one()
        export_vals, errors = self._export_invoice_vals(invoice)
        # TODO: error handling; c.f. _export_invoice_constraints
        # TODO: generate
        # TODO: sign
        edi_xml = "<xml>Veri*Factu</xml>"
        return edi_xml, errors
