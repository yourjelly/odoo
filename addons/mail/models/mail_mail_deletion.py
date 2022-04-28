# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class MailMailDeletion(models.Model):
    """Table that stores the <mail.mail> we need to delete.

    The deletion of the <mail.mail> is very expensive, so we delay the deletion
    at most as we can and we create an entry in this table instead.

    The <mail.mail> will be removed in batch, in a CRON.
    """
    _name = 'mail.mail.deletion'
    _description = 'Mail Deletion'

    mail_id = fields.Many2one('mail.mail', 'Mail', required=True, ondelete='cascade')

    @api.autovacuum
    def _gc_mail_mail(self):
        """Remove all the <mail.mail> we need to delete.

        The <mail.mail.deletion> will be removed tanks to the "ondelete" on
        the mail_id field.
        """
        mails_to_delete = self.env['mail.mail.deletion'].search_read([], ['mail_id'])
        mail_ids_to_delete = [values['mail_id'][0] for values in mails_to_delete]
        _logger.info('Remove %i mails', len(mail_ids_to_delete))
        self.env['mail.mail'].browse(mail_ids_to_delete).unlink()
