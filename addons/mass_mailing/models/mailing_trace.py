# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class Notification(models.Model):
    _inherit = 'mail.notification'

    mail_id_int = fields.Integer(
        string='Mail ID (tech)',
        help='ID of the related mail_mail. This field is an integer field because '
             'the related mail_mail can be deleted separately from its statistics. '
             'However the ID is needed for several action and controllers.',
        index=True,
    )

    notification_status = fields.Selection(selection_add=[
        ('opened', 'Opened'),
        ('replied', 'Replied'),
        ('ignored', 'Ignored'),
        ('clicked', 'Clicked'),
    ])

    # Dates
    ignored = fields.Datetime(help='Date when the email has been invalidated. '
                              'Invalid emails are blacklisted, opted-out or invalid email format',
                              compute='_compute_notification_date', store=True)
    scheduled = fields.Datetime(help='Date when the email has been created', default=fields.Datetime.now)
    sent = fields.Datetime(help='Date when the email has been sent',
                                compute='_compute_notification_date', store=True)
    exception = fields.Datetime(help='Date of technical error leading to the email not being sent',
                                compute='_compute_notification_date', store=True)
    opened = fields.Datetime(help='Date when the email has been opened the first time',
                             compute='_compute_notification_date', store=True)
    replied = fields.Datetime(help='Date when this email has been replied for the first time.',
                              compute='_compute_notification_date', store=True)
    bounced = fields.Datetime(help='Date when this email has bounced.',
                              compute='_compute_notification_date', store=True)

    # Link tracking
    links_click_ids = fields.One2many('link.tracker.click', 'mailing_trace_id', string='Links click')
    clicked = fields.Datetime(help='Date when customer clicked on at least one tracked link',
                              compute='_compute_notification_date', store=True)

    # campaign / wave data
    mass_mailing_id = fields.Many2one('mailing.mailing', string='Mailing', index=True, ondelete='cascade')
    campaign_id = fields.Many2one(
        related='mass_mailing_id.campaign_id',
        string='Campaign',
        store=True, readonly=True, index=True)

    state_update = fields.Datetime(compute="_compute_state", string='State Update',
                                   help='Last state update of the mail', store=True)

    display_name = fields.Char(compute='_compute_display_name')

    # must be renamed ``notification_type``
    trace_type = fields.Selection([('mail', 'Mail')], string='Type', default='mail', required=True)

    email = fields.Char(string="Email")
    message_id = fields.Char(string='Message-ID')
    # document
    model = fields.Char(string='Document model')
    res_id = fields.Integer(string='Document ID')

    failure_type = fields.Selection(selection=[
        ("SMTP", "Connection failed (outgoing mail server problem)"),
        ("RECIPIENT", "Invalid email address"),
        ("BOUNCE", "Email address rejected by destination"),
        ("UNKNOWN", "Unknown error"),
    ], string='Failure type')

    @api.depends('trace_type', 'mass_mailing_id')
    def _compute_display_name(self):
        for trace in self:
            trace.display_name = '%s: %s (%s)' % (trace.trace_type, trace.mass_mailing_id.name, trace.id)

    def _get_records(self, mail_ids=None, mail_message_ids=None, domain=None):
        if not self.ids and mail_ids:
            base_domain = [('mail_id_int', 'in', mail_ids)]
        elif not self.ids and mail_message_ids:
            base_domain = [('message_id', 'in', mail_message_ids)]
        else:
            base_domain = [('id', 'in', self.ids)]
        if domain:
            base_domain = ['&'] + domain + base_domain
        return self.search(base_domain)

    def set_opened(self, mail_ids=None, mail_message_ids=None):
        traces = self._get_records(mail_ids, mail_message_ids, [('opened', '=', False)])
        traces.write({'notification_status': 'opened'})
        return traces

    def set_clicked(self, mail_ids=None, mail_message_ids=None):
        traces = self._get_records(mail_ids, mail_message_ids, [('clicked', '=', False)])
        traces.write({'notification_status': 'clicked'})
        return traces

    def set_replied(self, mail_ids=None, mail_message_ids=None):
        traces = self._get_records(mail_ids, mail_message_ids, [('replied', '=', False)])
        traces.write({'notification_status': 'replied'})
        return traces

    def set_bounced(self, mail_ids=None, mail_message_ids=None):
        traces = self._get_records(mail_ids, mail_message_ids, [('bounced', '=', False), ('opened', '=', False)])
        traces.write({'notification_status': 'bounced'})
        return traces

    @api.model_create_multi
    def create(self, values_list):
        for values in values_list:
            if 'mail_id' in values:
                values['mail_id_int'] = values['mail_id']
        return super(Notification, self).create(values_list)

    @api.depends('notification_type')
    def _compute_notification_date(self):
        self.update({'state_update': fields.Datetime.now()})
        for notification in self:
            if notification.notification_status == 'ignored':
                notification.ignored = fields.Datetime.now()
            elif notification.notification_status == 'exception':
                notification.exception = fields.Datetime.now()
            elif notification.notification_status == 'opened':
                notification.opened = fields.Datetime.now()
            elif notification.notification_status == 'replied':
                notification.replied = fields.Datetime.now()
            elif notification.notification_status == 'bounced':
                notification.bounced = fields.Datetime.now()
            elif notification.notification_status == 'sent':
                notification.sent = fields.Datetime.now()
            elif notification.notification_status == 'ready':
                notification.ready = fields.Datetime.now()
