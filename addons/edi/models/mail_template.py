# -*- coding: utf-8 -*-

from odoo import api, models


class MailTemplate(models.Model):
    _inherit = "mail.template"

    def generate_email(self, res_ids, fields):
        # OVERRIDE
        res = super().generate_email(res_ids, fields)

        multi_mode = True
        if isinstance(res_ids, int):
            res_ids = [res_ids]
            multi_mode = False

        if res_ids and self.model and 'edi.mixin' in self.env[self.model]._inherits:
            records = self.env[self.model].browse(res_ids)
            for record in records:
                record_data = (res[record.id] if multi_mode else res)
                for edi_document in record.edi_document_ids:
                    record._edi_prepare_to_send_by_mail(record_data, edi_document)

        return res
