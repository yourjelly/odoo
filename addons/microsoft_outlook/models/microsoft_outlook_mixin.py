# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
import logging

from werkzeug.urls import url_encode, url_join

from odoo import _, api, fields, tools, models
from odoo.exceptions import AccessError, UserError
from odoo.tools.misc import hmac

_logger = logging.getLogger(__name__)


class MicrosoftOutlookMixin(models.AbstractModel):

    _description = 'Microsoft Outlook Mixin'

    _email_field = None
    _server_type_field = None

    is_microsoft_outlook_configured = fields.Boolean('Is Outlook Credential Configured',
        compute='_compute_is_microsoft_outlook_configured')
    microsoft_outlook_uri = fields.Char(
        compute='_compute_microsoft_outlook_uri',
        string='Authentication URI',
        help='The URL to generate the authorization code from Outlook',
        groups='base.group_system')
    microsoft_outlook_token_id = fields.Many2one(
        'microsoft.outlook.token', string='Outlook Token',
        compute='_compute_microsoft_outlook_token_id')

    @api.depends(lambda self: (self._email_field, self._server_type_field))
    def _compute_is_microsoft_outlook_configured(self):
        Config = self.env['ir.config_parameter'].sudo()
        microsoft_outlook_client_id = Config.get_param('microsoft_outlook_client_id')
        microsoft_outlook_client_secret = Config.get_param('microsoft_outlook_client_secret')
        is_configured = bool(microsoft_outlook_client_id and microsoft_outlook_client_secret)

        outlook_servers, normal_servers = self._split_outlook_servers()
        outlook_servers.is_microsoft_outlook_configured = is_configured
        normal_servers.is_microsoft_outlook_configured = False

    @api.depends(lambda self: (self._email_field, self._server_type_field, 'is_microsoft_outlook_configured'))
    def _compute_microsoft_outlook_uri(self):
        OutlookToken = self.env['microsoft.outlook.token']
        Config = self.env['ir.config_parameter'].sudo()
        base_url = self.get_base_url()
        microsoft_outlook_client_id = Config.get_param('microsoft_outlook_client_id')

        outlook_servers, normal_servers = self._split_outlook_servers()
        normal_servers.microsoft_outlook_uri = False

        for record in outlook_servers:
            email = tools.email_normalize(record[self._email_field])
            if not record.id or not record.is_microsoft_outlook_configured or not email:
                record.microsoft_outlook_uri = False
                continue

            record.microsoft_outlook_uri = url_join(self._get_microsoft_endpoint(), 'authorize?%s' % url_encode({
                'client_id': microsoft_outlook_client_id,
                'response_type': 'code',
                'redirect_uri': url_join(base_url, '/microsoft_outlook/confirm'),
                'response_mode': 'query',
                # offline_access is needed to have the refresh_token
                'scope': f'offline_access {" ".join(OutlookToken._SCOPES)}',
                'state': json.dumps({
                    'model': record._name,
                    'id': record.id,
                    'email': email,
                    'csrf_token': record._get_outlook_csrf_token(),
                })
            }))

    @api.depends(lambda self: (self._email_field, self._server_type_field))
    def _compute_microsoft_outlook_token_id(self):
        outlook_servers, normal_servers = self._split_outlook_servers()
        normal_servers.microsoft_outlook_token_id = False

        all_emails = list(map(tools.email_normalize, outlook_servers.mapped(self._email_field)))
        tokens = self.env['microsoft.outlook.token'].search([('email', 'in', all_emails)])
        tokens_per_email = {token.email: token for token in tokens}
        for record, email in zip(outlook_servers, all_emails):
            record.microsoft_outlook_token_id = tokens_per_email.get(email, False)

    def open_microsoft_outlook_uri(self):
        """Open the URL to accept the Outlook permission.

        This is done with an action, so we can force the user the save the form.
        We need him to save the form so the current mail server record exist in DB and
        we can include the record ID in the URL.
        """
        self.ensure_one()

        if not self.env.user.has_group('base.group_system'):
            raise AccessError(_('Only the administrator can link an Outlook mail server.'))

        if not self.is_microsoft_outlook_configured:
            raise UserError(_('Please configure your Outlook credentials.'))

        if not tools.email_normalize(self[self._email_field]):
            raise UserError(_('Please enter a valid email address.'))

        return {
            'type': 'ir.actions.act_url',
            'url': self.microsoft_outlook_uri,
        }

    def _get_outlook_csrf_token(self):
        """Generate a CSRF token that will be verified in `microsoft_outlook_callback`.

        This will prevent a malicious person to make an admin user disconnect the mail servers.
        """
        self.ensure_one()
        _logger.info('Microsoft Outlook: generate CSRF token for %s #%i', self._name, self.id)
        return hmac(
            env=self.env(su=True),
            scope='microsoft_outlook_oauth',
            message=(self._name, self.id, tools.email_normalize(self[self._email_field])),
        )

    @api.model
    def _get_microsoft_endpoint(self):
        return self.env['ir.config_parameter'].sudo().get_param(
            'microsoft_outlook.endpoint',
            'https://login.microsoftonline.com/common/oauth2/v2.0/',
        )

    def _split_outlook_servers(self):
        outlook_servers = self.filtered(lambda server: server[self._server_type_field] == 'outlook')
        return outlook_servers, self - outlook_servers
