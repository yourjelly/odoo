# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.exceptions import UserError


class IrAttachment(models.Model):
    _inherit = "ir.attachment"

    def unlink(self):
        if self.env['account.move'].search_count([
            ('message_main_attachment_id', 'in', self.ids),
            ('country_code', '=', 'HU'),
            ('state', '=', 'posted'),
            '|',
            ('l10n_hu_edi_active_transaction_id', '=', False),
            ('l10n_hu_edi_active_transaction_id.reply_status', '!=', 'error'),
        ]):
            raise UserError('Cannot delete a PDF once it has been posted and not rejected by NAV')
        return super().unlink()
