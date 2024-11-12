# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from markupsafe import Markup
from werkzeug.urls import url_join

from odoo import fields, models, _
from odoo.addons.sms.tools.sms_api import SmsApi


class MailingSmsTest(models.TransientModel):
    _description = 'Test SMS Mailing'

    def _default_numbers(self):
        previous_numbers = self.env['mailing.sms.test'].search([('create_uid', '=', self.env.uid)], order='create_date desc', limit=1).numbers
        return previous_numbers or self.env.user.partner_id.phone_sanitized or ""

    numbers = fields.Text(string='Number(s)', required=True,
                          default=_default_numbers, help='Carriage-return-separated list of phone numbers')
    mailing_id = fields.Many2one('mailing.mailing', string='Mailing', required=True, ondelete='cascade')

    def _prepare_mass_sms_trace_values(self, record, sms_values):
        trace_code = self.env['mailing.trace']._get_random_code()
        trace_values = {
            'mass_mailing_id': self.mailing_id.id,
            'res_id': record.id,
            'sms_code': trace_code,
            'model': record._name,
            'sms_number': sms_values['number'],
            'trace_type': 'sms',
        }
        unsubscribe_url = self.env['sms.composer']._get_unsubscribe_url(self.mailing_id.id, trace_code)
        sms_values['body'] = '%s\n%s' % (sms_values['body'], _('STOP SMS: %s', unsubscribe_url))
        return trace_values

    def action_send_sms(self):
        self.ensure_one()

        numbers = [number.strip() for number in self.numbers.splitlines()]
        sanitized_numbers = [self.env.user._phone_format(number=number) for number in numbers]
        invalid_numbers = [number for sanitized, number in zip(sanitized_numbers, numbers) if not sanitized]

        record = self.env[self.mailing_id.mailing_model_real].search([], limit=1)
        body = self.mailing_id.body_plaintext
        if record:
            # Returns a proper error if there is a syntax error with qweb
            body = self.env['mail.render.mixin']._render_template(body, self.mailing_id.mailing_model_real, record.ids)[record.id]
        # Include the unsubscribe link if sms_allow_unsubscribe is enabled
        if self.mailing_id.sms_allow_unsubscribe:
            sms_values = {'number': sanitized_numbers, 'body': body, 'uuid': ''}  # Example SMS value dictionary
            trace_values = self._prepare_mass_sms_trace_values(record, sms_values)
            self.env['mailing.trace'].sudo().create(trace_values)
            body = sms_values['body']

        new_sms_messages_sudo = self.env['sms.sms'].sudo().create([{'body': body, 'number': number} for number in numbers])
        sms_api = SmsApi(self.env)
        sent_sms_list = sms_api._send_sms_batch([{
            'content': body,
            'numbers': [{'number': sms_id.number, 'uuid': sms_id.uuid} for sms_id in new_sms_messages_sudo],
        }], delivery_reports_url=url_join(self[0].get_base_url(), '/sms/status'))

        error_messages = {}
        if any(sent_sms.get('state') != 'success' for sent_sms in sent_sms_list):
            error_messages = sms_api._get_sms_api_error_messages()

        notification_messages = []
        sms_uuid_to_number_map = {sms.uuid: sms.number for sms in new_sms_messages_sudo}
        for sent_sms in sent_sms_list:
            number = sms_uuid_to_number_map.get(sent_sms.get('uuid'))
            if invalid_numbers:
                notification_messages.append(_('The following numbers are not correctly encoded: %s',
                    ', '.join(invalid_numbers)))
            elif sent_sms.get('state') == 'success' and not invalid_numbers:
                notification_messages.append(
                    _('Test SMS successfully sent to %s', number))
            else:
                notification_messages.append(
                    _(
                        "Test SMS could not be sent to %(destination)s: %(state)s",
                        destination=number,
                        state=error_messages.get(sent_sms["state"], _("An error occurred.")),
                    )
                )

        if notification_messages:
            message_body = Markup(
                f"<ul>{''.join('<li>%s</li>' for _ in notification_messages)}</ul>"
            ) % tuple(notification_messages)
            self.mailing_id._message_log(body=message_body)

        return True
