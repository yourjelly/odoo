# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import Command, models
from odoo.exceptions import UserError
from odoo.tools import email_normalize
from odoo.tools.misc import attrgetter
from odoo.tools.translate import _


class ResPartner(models.Model):
    _inherit = 'res.partner'

    def _assert_user_email_uniqueness(self):
        """Check that the email can be used to create a new user."""
        self.ensure_one()
        email = email_normalize(self.email)
        if not email:
            raise UserError(_('Email %(email)s of contact %(partner_name)s is invalid.', email=email, partner_name=self.name))

        partner_user_ids = self.sudo().with_context(active_test=False).user_ids
        domain = [
            ('id', 'not in', partner_user_ids.ids),
            ('login', '=ilike', email),
        ]
        if self.env['res.users'].sudo().with_context(active_test=False).search_count(domain):
            raise UserError(_('Email %(email)s is already used by an existing user.', email=email))

    def _portal_create_user(self):
        """ create a new user for this partner
            :returns record of res.users
        """
        return self.env['res.users'].with_context(no_reset_password=True)._create_user_from_template({
            'company_id': self.env.company.id,
            'company_ids': [Command.set(self.env.company.ids)],
            'email': email_normalize(self.email),
            'login': email_normalize(self.email),
            'partner_id': self.id,
        })

    def _portal_send_user_invitation_email(self, user, welcome_message=False):
        """ send notification email to a new portal user """
        self.ensure_one()
        if not user:
            raise UserError(_('You should grant portal access to the partner "%(partner_name)s" before sending him the invitation email.',
                partner_name=self.name))

        # determine subject and body in the portal user's language
        template = self.env.ref('portal.mail_template_data_portal_welcome')
        if not template:
            raise UserError(_('The template "Portal: new user" not found for sending email to the portal user.'))

        portal_url = self._get_signup_url_for_action()[self.id]
        template.with_context(dbname=self._cr.dbname, portal_url=portal_url, lang=self.lang,
            welcome_message=welcome_message).send_mail(user.id)

        return True

    def action_grant_portal_access(self, user=False, welcome_message=False):
        """Grant the portal access to the partner.

        If the partner has no linked user, we will create a new one in the same company
        as the partner (or in the current company if not set).

        An invitation email will be sent to the partner.
        """
        self.ensure_one()
        self._assert_user_email_uniqueness()

        partner_user_ids = self.sudo().with_context(active_test=False).user_ids
        internal_users = self.partner_user_ids.filtered(lambda user: user.has_group('base.group_user'))
        if internal_users and not user:
            raise UserError(_('Partner %(partner_name)s is already an internal user. It cannot be set to portal here.', partner_name=self.name))

        user = user or max(partner_user_ids, default=self.env['res.users'], key=attrgetter('create_date'))
        if user:
            user_sudo = user.sudo()
        else:
            # create a user if necessary and make sure it is in the portal group
            company = self.company_id or self.env.company
            user_sudo = self.sudo().with_company(company.id)._portal_create_user()

        if not user_sudo.active or not user_sudo._is_portal():
            group_portal = self.env.ref('base.group_portal')
            group_public = self.env.ref('base.group_public')
            user_sudo.write({'active': True, 'groups_id': [Command.link(group_portal.id), Command.unlink(group_public.id)]})
            # prepare for the signup process
            self.signup_prepare()

        self.with_context(active_test=True)._portal_send_user_invitation_email(user, welcome_message=welcome_message)

    def action_resend_portal_access_invitation(self, user=False, welcome_message=False):
        """Re-send the invitation email to the partner."""
        self.ensure_one()

        user = user or max(self.user_ids.filtered(lambda user: user._is_portal()), default=self.env['res.users'], key=attrgetter('create_date'))
        if not user:
            raise UserError(_('You should first grant the portal access to the partner "%(partner_name)s".', partner_name=self.name))

        self.with_context(active_test=True)._portal_send_user_invitation_email(user, welcome_message=welcome_message)

    def action_revoke_portal_access(self, user=False):
        """Remove the user of the partner from the portal group.

        If the user was only in the portal group, we archive it.
        """
        self.ensure_one()
        self._assert_user_email_uniqueness()

        user = user or max(self.user_ids.filtered(lambda user: user._is_portal()), default=self.env['res.users'], key=attrgetter('create_date'))
        if not user:
            raise UserError(_('The partner "%(partner_name)s" has no portal access.', partner_name=self.name))

        # Remove the sign up token, so it can not be used
        self.signup_cancel()
        user_sudo = user.sudo()

        # remove the user from the portal group
        if user_sudo and user_sudo._is_portal():
            group_portal = self.env.ref('base.group_portal')
            group_public = self.env.ref('base.group_public')
            # if user belongs to portal only, deactivate it
            if len(user_sudo.groups_id) <= 1:
                user_sudo.write({'groups_id': [Command.unlink(group_portal.id), Command.link(group_public.id)], 'active': False})
            else:
                user_sudo.write({'groups_id': [Command.unlink(group_portal.id), Command.link(group_public.id)]})

    def can_edit_vat(self):
        ''' `vat` is a commercial field, synced between the parent (commercial
        entity) and the children. Only the commercial entity should be able to
        edit it (as in backend). '''
        return not self.parent_id
