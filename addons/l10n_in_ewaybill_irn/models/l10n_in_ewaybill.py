# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api, _


class Ewaybill(models.Model):
    _inherit = "l10n.in.ewaybill"
    _description = "Ewaybill for stock movement"

    def _get_ewaybill_mode(self):
        """
            There is two type of api call to create E-waybill
            1. base on IRN, IRN is number created when we do E-invoice (owerwrite in l10n_in_ewaybill_irn module)
            2. direct call, when E-invoice not aplicable or it"s credit not
        """
        einvoice_in_edi_format = self.account_move_id.journal_id.edi_format_ids.filtered(lambda f: f.code == "in_einvoice_1_03")
        return einvoice_in_edi_format and einvoice_in_edi_format._get_move_applicability(self.account_move_id) and "irn" or "direct"

    def _ewaybill_generate_direct_json(self):
        json_payload = {}
        if self._get_ewaybill_mode() == "irn" and self.account_move_id:
            invoice = self.account_move_id
            json_payload = {
                "Irn": invoice._get_l10n_in_edi_response_json().get("Irn"),
                "Distance": invoice.l10n_in_distance,
            }
            if invoice.l10n_in_mode == "0":
                json_payload.update({
                    "TransId": invoice.l10n_in_transporter_id.vat,
                    "TransName": invoice.l10n_in_transporter_id.name,
                })
            elif invoice.l10n_in_mode == "1":
                json_payload.update({
                    "TransMode": invoice.l10n_in_mode,
                    "VehNo": invoice.l10n_in_vehicle_no,
                    "VehType": invoice.l10n_in_vehicle_type,
                })
            elif invoice.l10n_in_mode in ("2", "3", "4"):
                doc_date = invoice.l10n_in_transportation_doc_date
                json_payload.update({
                    "TransMode": invoice.l10n_in_mode,
                    "TransDocDt": doc_date and doc_date.strftime("%d/%m/%Y") or False,
                    "TransDocNo": invoice.l10n_in_transportation_doc_no,
                })
        return json_payload
