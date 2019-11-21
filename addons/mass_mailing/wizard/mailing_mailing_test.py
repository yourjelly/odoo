# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, tools
from odoo.addons.mass_mailing.models.mailing import MASS_MAILING_BUSINESS_MODELS


class MailingMailingTest(models.TransientModel):
    _name = 'mailing.mailing.test'
    _description = 'Sample Mail Wizard'

    @api.model
    def default_get(self, fields):
        result = super(MailingMailingTest, self).default_get(fields)
        default_mailing_id = self.env.context.get('default_mailing_id')
        if not default_mailing_id or 'resource_ref' not in fields:
            return result
        mailing = self.env['mailing.mailing'].browse(default_mailing_id)
        resource = self.env[mailing.mailing_model_real].search([], limit=1)
        if resource:
            result['resource_ref'] = '%s,%s' % (mailing.mailing_model_real, resource.id)
        return result

    @api.model
    def _selection_target_model(self):
        return [(model.model, model.name) for model in self.env['ir.model'].search([('model', 'in', MASS_MAILING_BUSINESS_MODELS)])]

    email_to = fields.Char(string='Recipients', required=True,
                           help='Comma-separated list of email addresses.',
                           default=lambda self: self.env['mail.message']._get_default_from())
    mailing_id = fields.Many2one('mailing.mailing', string='Mailing', required=True, ondelete='cascade')

    use_record = fields.Boolean('Use a real Record',
                                help="Dynamic placeholder will replace with a real data based on the record reference")
    resource_ref = fields.Reference(string='Record Reference Example', selection='_selection_target_model')

    def send_mail_test(self):
        self.ensure_one()
        mails = self.env['mail.mail']
        mailing = self.mailing_id
        test_emails = tools.email_split(self.email_to)
        mass_mail_layout = self.env.ref('mass_mailing.mass_mailing_mail_layout')
        mail_info_ref = {}
        if self.use_record and self.resource_ref:
            composer_values = {
                'author_id': self.env.user.partner_id.id,
                'body': mailing.body_html,
                'subject': mailing.subject,
                'model': mailing.mailing_model_real,
                'email_from': mailing.email_from,
                'mass_mailing_id': mailing.id,
            }
            if mailing.reply_to_mode == 'email':
                composer_values['reply_to'] = mailing.reply_to
            composer = self.env['mail.compose.message'].create(composer_values)
            mail_info_ref.update(composer.render_message(self.resource_ref.id))

        for test_mail in test_emails:
            # Convert links in absolute URLs before the application of the shortener
            mailing.write({'body_html': self.env['mail.thread']._replace_local_links(mailing.body_html)})
            body = mail_info_ref.get('body', False) or tools.html_sanitize(mailing.body_html, sanitize_attributes=True, sanitize_style=True)
            mail_values = {
                'email_from': mail_info_ref.get('email_from', mailing.email_from),
                'reply_to': mail_info_ref.get('reply_to', mailing.reply_to),
                'email_to': test_mail,
                'subject': mail_info_ref.get('subject', mailing.subject),
                'body_html': mass_mail_layout.render({'body': body}, engine='ir.qweb', minimal_qcontext=True),
                'notification': True,
                'mailing_id': mailing.id,
                'attachment_ids': [(4, attachment.id) for attachment in mailing.attachment_ids],
                'auto_delete': True,
            }
            mail = self.env['mail.mail'].create(mail_values)
            mails |= mail
        mails.send()
        return True
