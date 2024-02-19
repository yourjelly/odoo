# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from dateutil.relativedelta import relativedelta

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError
from markupsafe import Markup


class ServerActions(models.Model):
    """ Add mail.thread related options in server actions. """
    _name = 'ir.actions.server'
    _description = 'Server Action'
    _inherit = ['ir.actions.server']

    state = fields.Selection(
        selection_add=[
            ('next_activity', 'Create Activity'),
            ('mail_post', 'Send Email'),
            ('notify_user', 'Notify User'),
            ('notify_channel', 'Notify Channel'),
            ('followers', 'Add Followers'),
            ('remove_followers', 'Remove Followers'),
            ('object_create',),
        ],
        ondelete={'mail_post': 'cascade',
                  'notify_user': 'cascade',
                  'notify_channel': 'cascade',
                  'followers': 'cascade',
                  'remove_followers': 'cascade',
                  'next_activity': 'cascade',
        }
    )
    # Followers
    partner_ids = fields.Many2many('res.partner', compute='_compute_partner_ids', readonly=False, store=True)
    # Notify
    notify_user_id = fields.Many2one('res.users', string='User to Notify', domain="[('share', '=', False), ('active', '=', True)]")
    notify_channel_id = fields.Many2one('discuss.channel', string='Channel to Notify')
    notify_user_is_member = fields.Boolean('User is Member', compute='_compute_notify_user_is_member')
    notify_from = fields.Many2one('res.users', string='Send as', domain="[('share', '=', False), '|', ('id', '=', 1), ('active', '=', True)]", default=lambda self: self.env.user)
    notify_msg = fields.Html('Message', default=lambda self: _('You have a new message'))
    # Message Post / Email
    template_id = fields.Many2one(
        'mail.template', 'Email Template',
        domain="[('model_id', '=', model_id)]",
        compute='_compute_template_id',
        ondelete='set null', readonly=False, store=True,
    )
    # Message post
    mail_post_autofollow = fields.Boolean(
        'Subscribe Recipients', compute='_compute_mail_post_autofollow',
        readonly=False, store=True)
    mail_post_method = fields.Selection(
        selection=[('email', 'Email'), ('comment', 'Message'), ('note', 'Note')],
        string='Send Email As',
        compute='_compute_mail_post_method',
        readonly=False, store=True)

    # Next Activity
    activity_type_id = fields.Many2one(
        'mail.activity.type', string='Activity Type',
        domain="['|', ('res_model', '=', False), ('res_model', '=', model_name)]",
        compute='_compute_activity_type_id', readonly=False, store=True,
        ondelete='restrict')
    activity_summary = fields.Char(
        'Title',
        compute='_compute_activity_info', readonly=False, store=True)
    activity_note = fields.Html(
        'Note',
        compute='_compute_activity_info', readonly=False, store=True)
    activity_date_deadline_range = fields.Integer(
        string='Due Date In',
        compute='_compute_activity_info', readonly=False, store=True)
    activity_date_deadline_range_type = fields.Selection(
        [('days', 'Days'),
         ('weeks', 'Weeks'),
         ('months', 'Months')],
        string='Due type', default='days',
        compute='_compute_activity_info', readonly=False, store=True)
    activity_user_type = fields.Selection(
        [('specific', 'Specific User'),
         ('generic', 'Dynamic User (based on record)')],
         string='User Type',
        compute='_compute_activity_info', readonly=False, store=True,
        help="Use 'Specific User' to always assign the same user on the next activity. Use 'Dynamic User' to specify the field name of the user to choose on the record.")
    activity_user_id = fields.Many2one(
        'res.users', string='Responsible',
        compute='_compute_activity_info', readonly=False, store=True)
    activity_user_field_name = fields.Char(
        'User Field',
        compute='_compute_activity_info', readonly=False, store=True)

    @api.depends('state')
    def _compute_available_model_ids(self):
        mail_thread_based = self.filtered(
            lambda action: action.state in {'mail_post', 'followers', 'remove_followers', 'next_activity'}
        )
        if mail_thread_based:
            mail_models = self.env['ir.model'].search([('is_mail_thread', '=', True), ('transient', '=', False)])
            for action in mail_thread_based:
                action.available_model_ids = mail_models.ids
        super(ServerActions, self - mail_thread_based)._compute_available_model_ids()

    @api.depends('model_id', 'state')
    def _compute_template_id(self):
        to_reset = self.filtered(
            lambda act: act.state != 'mail_post' or \
                        (act.model_id != act.template_id.model_id)
        )
        if to_reset:
            to_reset.template_id = False

    @api.depends('notify_from', 'notify_channel_id')
    def _compute_notify_user_is_member(self):
        for action in self:
            if action.notify_from and action.notify_channel_id:
                action.notify_user_is_member = action.notify_from.partner_id in action.notify_channel_id.sudo().channel_partner_ids
            else:
                action.notify_user_is_member = False

    @api.depends('state', 'mail_post_method')
    def _compute_mail_post_autofollow(self):
        to_reset = self.filtered(lambda act: act.state != 'mail_post' or act.mail_post_method == 'email')
        if to_reset:
            to_reset.mail_post_autofollow = False
        other = self - to_reset
        if other:
            other.mail_post_autofollow = True

    @api.depends('state')
    def _compute_mail_post_method(self):
        to_reset = self.filtered(lambda act: act.state != 'mail_post')
        if to_reset:
            to_reset.mail_post_method = False
        other = self - to_reset
        if other:
            other.mail_post_method = 'comment'

    @api.depends('state')
    def _compute_partner_ids(self):
        to_reset = self.filtered(lambda act: act.state != 'followers')
        if to_reset:
            to_reset.partner_ids = False

    @api.depends('model_id', 'state')
    def _compute_activity_type_id(self):
        to_reset = self.filtered(
            lambda act: act.state != 'next_activity' or \
                        (act.model_id.model != act.activity_type_id.res_model)
        )
        if to_reset:
            to_reset.activity_type_id = False

    @api.depends('state', 'activity_type_id')
    def _compute_activity_info(self):
        to_reset = self.filtered(lambda act: act.state != 'next_activity')
        if to_reset:
            to_reset.activity_summary = False
            to_reset.activity_note = False
            to_reset.activity_date_deadline_range = False
            to_reset.activity_date_deadline_range_type = False
            to_reset.activity_user_type = False
            to_reset.activity_user_id = False
            to_reset.activity_user_field_name = False
        to_default = self.filtered(lambda act: act.state == 'next_activity')
        for action in to_default:
            if not action.activity_summary:
                action.activity_summary = action.activity_type_id.summary
            if not action.activity_date_deadline_range_type:
                action.activity_date_deadline_range_type = 'days'
            if not action.activity_user_type:
                action.activity_user_type = 'specific'
            if not action.activity_user_field_name:
                action.activity_user_field_name = 'user_id'

    @api.constrains('activity_date_deadline_range')
    def _check_activity_date_deadline_range(self):
        if any(action.activity_date_deadline_range < 0 for action in self):
            raise ValidationError(_("The 'Due Date In' value can't be negative."))

    @api.constrains('model_id', 'template_id')
    def _check_mail_template_model(self):
        for action in self.filtered(lambda action: action.state == 'mail_post'):
            if action.template_id and action.template_id.model_id != action.model_id:
                raise ValidationError(
                    _('Mail template model of %(action_name)s does not match action model.',
                      action_name=action.name
                     )
                )

    @api.constrains('state', 'model_id')
    def _check_mail_model_coherency(self):
        for action in self:
            if action.state in {'mail_post', 'followers', 'remove_followers', 'next_activity'} and action.model_id.transient:
                raise ValidationError(_("This action cannot be done on transient models."))
            if action.state in {'mail_post', 'followers', 'remove_followers'} and not action.model_id.is_mail_thread:
                raise ValidationError(_("This action can only be done on a mail thread models"))
            if action.state == 'next_activity' and not action.model_id.is_mail_activity:
                raise ValidationError(_("A next activity can only be planned on models that use activities."))

    def _run_action_followers_multi(self, eval_context=None):
        Model = self.env[self.model_name]
        if self.partner_ids and hasattr(Model, 'message_subscribe'):
            records = Model.browse(self._context.get('active_ids', self._context.get('active_id')))
            records.message_subscribe(partner_ids=self.partner_ids.ids)
        return False

    def _run_action_remove_followers_multi(self, eval_context=None):
        Model = self.env[self.model_name]
        if self.partner_ids and hasattr(Model, 'message_unsubscribe'):
            records = Model.browse(self._context.get('active_ids', self._context.get('active_id')))
            records.message_unsubscribe(partner_ids=self.partner_ids.ids)
        return False

    def _run_action_notify_user_multi(self, eval_context=None):
        if not self.notify_user_id or not self._context.get('active_id'):
            return False
        records = self.env[self.model_name].browse(self._context.get('active_ids', self._context.get('active_id')))
        from_user = self.notify_from or self.env.user
        to_partner = self.notify_user_id.partner_id
        channel = self.env['discuss.channel'].channel_get(set((from_user.partner_id + to_partner).ids))
        body = self.notify_msg
        for record in records:
            sent_from_automation = _("Sent by an Automation Rule on <a href='#' data-oe-model='%s' data-oe-id='%s'>%s</a>", record._name, record.id, record.display_name)
            body += Markup("<p class='small text-muted mt-2'>%s</p>" % sent_from_automation)
            channel.with_user(from_user).message_post(body=body, message_type='comment', subtype_xmlid='mail.mt_comment')
        return False

    def _run_action_notify_channel_multi(self, eval_context=None):
        if not self.notify_channel_id or not self._context.get('active_id'):
            return False
        records = self.env[self.model_name].browse(self._context.get('active_ids', self._context.get('active_id')))
        from_user = self.notify_from or self.env.user
        channel_sudo = self.notify_channel_id.with_user(from_user).sudo()
        if from_user.partner_id not in channel_sudo.channel_partner_ids:
            channel_sudo.add_members(partner_ids=from_user.partner_id.ids)
        body = self.notify_msg
        for record in records:
            sent_from_automation = _("Sent by an Automation Rule on <a href='#' data-oe-model='%s' data-oe-id='%s'>%s</a>", record._name, record.id, record.display_name)
            body += Markup("<p class='small text-muted mt-2'>%s</p>" % sent_from_automation)
            channel_sudo.with_user(from_user).sudo().message_post(body=body, message_type='comment', subtype_xmlid='mail.mt_comment')
        return False

    def _is_recompute(self):
        """When an activity is set on update of a record,
        update might be triggered many times by recomputes.
        When need to know it to skip these steps.
        Except if the computed field is supposed to trigger the action
        """
        records = self.env[self.model_name].browse(
            self._context.get('active_ids', self._context.get('active_id')))
        old_values = self._context.get('old_values')
        if old_values:
            domain_post = self._context.get('domain_post')
            tracked_fields = []
            if domain_post:
                for leaf in domain_post:
                    if isinstance(leaf, (tuple, list)):
                        tracked_fields.append(leaf[0])
            fields_to_check = [field for record, field_names in old_values.items() for field in field_names if field not in tracked_fields]
            if fields_to_check:
                field = records._fields[fields_to_check[0]]
                # Pick an arbitrary field; if it is marked to be recomputed,
                # it means we are in an extraneous write triggered by the recompute.
                # In this case, we should not create a new activity.
                if records & self.env.records_to_compute(field):
                    return True
        return False

    def _run_action_mail_post_multi(self, eval_context=None):
        # TDE CLEANME: when going to new api with server action, remove action
        if not self.template_id or (not self._context.get('active_ids') and not self._context.get('active_id')) or self._is_recompute():
            return False
        res_ids = self._context.get('active_ids', [self._context.get('active_id')])

        # Clean context from default_type to avoid making attachment
        # with wrong values in subsequent operations
        cleaned_ctx = dict(self.env.context)
        cleaned_ctx.pop('default_type', None)
        cleaned_ctx.pop('default_parent_id', None)
        cleaned_ctx['mail_create_nosubscribe'] = True  # do not subscribe random people to records
        cleaned_ctx['mail_post_autofollow'] = self.mail_post_autofollow

        if self.mail_post_method in ('comment', 'note'):
            records = self.env[self.model_name].with_context(cleaned_ctx).browse(res_ids)
            if self.mail_post_method == 'comment':
                subtype_id = self.env['ir.model.data']._xmlid_to_res_id('mail.mt_comment')
            else:
                subtype_id = self.env['ir.model.data']._xmlid_to_res_id('mail.mt_note')
            records.message_post_with_source(
                self.template_id,
                subtype_id=subtype_id,
            )
        else:
            template = self.template_id.with_context(cleaned_ctx)
            for res_id in res_ids:
                template.send_mail(
                    res_id,
                    force_send=False,
                    raise_exception=False
                )
        return False

    def _run_action_next_activity(self, eval_context=None):
        if not self.activity_type_id or not self._context.get('active_id') or self._is_recompute():
            return False

        records = self.env[self.model_name].browse(self._context.get('active_ids', self._context.get('active_id')))

        vals = {
            'summary': self.activity_summary or '',
            'note': self.activity_note or '',
            'activity_type_id': self.activity_type_id.id,
        }
        if self.activity_date_deadline_range > 0:
            vals['date_deadline'] = fields.Date.context_today(self) + relativedelta(**{
                self.activity_date_deadline_range_type: self.activity_date_deadline_range})
        for record in records:
            user = False
            if self.activity_user_type == 'specific':
                user = self.activity_user_id
            elif self.activity_user_type == 'generic' and self.activity_user_field_name in record:
                user = record[self.activity_user_field_name]
            if user:
                vals['user_id'] = user.id
            record.activity_schedule(**vals)
        return False

    @api.model
    def _get_eval_context(self, action=None):
        """ Override the method giving the evaluation context but also the
        context used in all subsequent calls. Add the mail_notify_force_send
        key set to False in the context. This way all notification emails linked
        to the currently executed action will be set in the queue instead of
        sent directly. This will avoid possible break in transactions. """
        eval_context = super(ServerActions, self)._get_eval_context(action=action)
        ctx = dict(eval_context['env'].context)
        ctx['mail_notify_force_send'] = False
        eval_context['env'].context = ctx
        return eval_context
