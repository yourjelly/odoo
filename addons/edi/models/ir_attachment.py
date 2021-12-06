# -*- coding: utf-8 -*-
from odoo import api, models, fields, _
from odoo.exceptions import UserError


class IrAttachment(models.Model):
    _inherit = 'ir.attachment'

    @api.ondelete(at_uninstall=False)
    def _unlink_except_linked_edi_document(self):
        edi_documents = self.env['edi.document'].search([('attachment_id', 'in', self.ids), ('is_done', '=', True)])
        if edi_documents:
            raise UserError(_("You can't unlink an attachment being an EDI document sent to the government."))
