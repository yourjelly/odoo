# -*- coding: utf-8 -*-

from odoo import api, models


class MailTemplate(models.Model):
    _inherit = "mail.template"

    def generate_email(self, res_ids, fields):
        res = super().generate_email(res_ids, fields)

        multi_mode = True
        if isinstance(res_ids, int):
            res_ids = [res_ids]
            multi_mode = False

        if self.model != 'account.move':
            return res

        existing_documents = self.env['account.edi.document'].search([('move_id', 'in', res_ids)])

        for record in self.env[self.model].browse(res_ids):
            available_formats = existing_documents.filtered(lambda a: a.move_id == record)
            (res[record.id] if multi_mode else res).setdefault('attachments', []).extend([(d.attachment_id.name, d.attachment_id.datas) for d in available_formats])

        return res
