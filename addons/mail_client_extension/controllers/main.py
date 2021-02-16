# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import base64
import datetime
import hmac
import json
import logging
import odoo
import requests
import werkzeug
from werkzeug.exceptions import Forbidden

from odoo import http, tools, _
from odoo.addons.iap.tools import iap_tools
from odoo.http import request

_logger = logging.getLogger(__name__)


class MailClientExtensionController(http.Controller):

    @http.route('/mail_client_extension/auth', type='http', auth="user", methods=['GET'], website=True)
    def auth(self, **values):
        """
         Once authenticated this route renders the view that shows an app wants to access Odoo.
         The user is invited to allow or deny the app. The form posts to `/mail_client_extension/auth/confirm`.
         """
        return request.render('mail_client_extension.app_auth', values)

    @http.route('/mail_client_extension/auth/confirm', type='http', auth="user", methods=['POST'])
    def auth_confirm(self, scope, friendlyname, redirect, info=None, do=None, **kw):
        """
        Called by the `app_auth` template. If the user decided to allow the app to access Odoo, a temporary auth code
        is generated and he is redirected to `redirect` with this code in the URL. It should redirect to the app, and
        the app should then exchange this auth code for an access token by calling
        `/mail_client_extension/auth/access_token`.
        """
        parsed_redirect = werkzeug.urls.url_parse(redirect)
        params = parsed_redirect.decode_query()
        if do:
            name = friendlyname if not info else f'{friendlyname}: {info}'
            auth_code = self._generate_auth_code(scope, name)
            # params is a MultiDict which does not support .update() with kwargs
            params.update({'success': 1, 'auth_code': auth_code, 'state': kw.get('state', '')})
        else:
            params.update({'success': 0, 'state': kw.get('state', '')})
        updated_redirect = parsed_redirect.replace(query=werkzeug.urls.url_encode(params))
        return werkzeug.utils.redirect(updated_redirect.to_url())

    # In this case, an exception will be thrown in case of preflight request if only POST is allowed.
    @http.route('/mail_client_extension/auth/access_token', type='json', auth="none", cors="*", methods=['POST', 'OPTIONS'])
    def auth_access_token(self, auth_code, **kw):
        """
        Called by the external app to exchange an auth code, which is temporary and was passed in a URL, for an
        access token, which is permanent, and can be used in the `Authorization` header to authorize subsequent requests
        """
        auth_message = self._get_auth_code_data(auth_code)
        if not auth_message:
            return {"error": "Invalid code"}
        request.uid = auth_message['uid']
        scope = 'odoo.plugin.' + auth_message.get('scope', '')
        api_key = request.env['res.users.apikeys']._generate(scope, auth_message['name'])
        return {'access_token': api_key }

    @http.route('/mail_client_extension/modules/get', type="json", auth="outlook", csrf=False, cors="*")
    def modules_get(self, **kwargs):
        """
            deprecated as of saas-14.3, not needed for newer versions of the mail plugin but necessary
            for supporting older versions
        """
        return {'modules': ['contacts', 'crm']}

    @http.route('/mail_client_extension/partner/enrich_and_create_company',
                type="json", auth="outlook", cors="*")
    def res_partner_enrich_and_create_company(self, partner_id):
        """
        Route used when the user clicks on the create and enrich partner button
        it will try to find a company using IAP, if a company is found
        the enriched company will then be created in the database
        """
        response = {}

        partner = request.env['res.partner'].browse(partner_id)

        normalized_email = partner.email_normalized
        if not normalized_email:
            response = {'error': 'contact has no email'}
            return response

        company_domain = normalized_email.split('@')[1]

        company, enrichment_info = self._create_company_from_iap(company_domain)

        response['enrichment_info'] = enrichment_info
        response['company'] = self._prepare_company_values(company)
        if company:
            partner.write({'parent_id': company})

        return response

    @http.route('/mail_client_extension/partner/get', type="json", auth="outlook", cors="*")
    def res_partner_get(self, email=None, name=None, partner_id=None, **kwargs):
        """
        returns a partner given it's id or an email and a name.
        In case the partner does not exist, we return partner having an id -1, we also look if an existing company
        matching the contact exists in the database, if none is found a new company is enriched and created automatically
        """
        response = {}

        if not (partner_id or (name and email)):
            return {'error': _('You need to specify at least the partner_id or the name and the email')}

        partner = None

        if partner_id:
            partner = request.env['res.partner'].browse(partner_id)
            email = partner.email
            normalized_email = partner.email_normalized
        else:
            normalized_email = tools.email_normalize(email)
            if not normalized_email:
                response['error'] = 'Bad email.'
                return response
            # Search for the partner based on the email.
            # If multiple are found, take the first one.
            partner = request.env['res.partner'].search(['|', ('email', 'in', [normalized_email, email]),
                                                         ('email_normalized', '=', normalized_email)], limit=1)

        response = self._prepare_contact_values(partner)

        #if no partner is found in the database, we should also return an empty one having id = -1, otherwise older versions of
        #plugin won't work
        if not response['partner']:
            sender_domain = normalized_email.split('@')[1]
            response['partner'] = {
                'id': -1,
                'email': email,
                'name': name,
                'enrichment_info': None,
            }
            company = self._find_existing_company(normalized_email)
            if not company:  # create and enrich company
                company, enrichment_info = self._create_company_from_iap(sender_domain)
                response['partner']['enrichment_info'] = enrichment_info
            response['partner']['company'] = self._prepare_company_values(company)

        return response

    @http.route('/mail_client_extension/partners/search', type="json", auth="outlook", cors="*")
    def res_partners_search(self, query, limit=30, **kwargs):
        """
        Used for the plugin search contact functionality where the user types a string query in order to search for
        matching contacts, the string query can either be the name of the contact, it's reference or it's email.
        We choose these fields because these are probably the most interesting fields that the user can perform a
        search on.
        The method returns an array containing the dicts of the matched contacts
        """
        filter_domain = ['|', '|', ('display_name', 'ilike', query), ('ref', '=', query), ('email', 'ilike', query)]
        # Search for the partner based on the email.
        # If multiple are found, take the first one.
        partners = request.env['res.partner'].search(filter_domain, limit=limit)

        partners = [
            self._prepare_partner_values(partner)
            for partner in partners
        ]
        return {"partners": partners}

    @http.route('/mail_client_extension/partner/create', type="json", auth="outlook", cors="*")
    def res_partner_create(self, email, name, company, **kwargs):
        # TODO search the company again instead of relying on the one provided here?
        # Create the partner if needed.
        partner_info = {
            'name': name,
            'email': email,
        }
        if company and company > -1:
            partner_info['parent_id'] = company
        partner = request.env['res.partner'].create(partner_info)

        response = {'id': partner.id}
        return response

    @http.route('/mail_client_extension/log_mail_content', type="json", auth="outlook", cors="*")
    def log_mail_content(self, model, res_id, message):
        if model not in self._mail_content_logging_models_whitelist():
            raise Forbidden()
        record = request.env[model].browse(res_id)
        record.message_post(body=message)

    def _get_auth_code_data(self, auth_code):
        data, auth_code_signature = auth_code.split('.')
        data = base64.b64decode(data)
        auth_code_signature = base64.b64decode(auth_code_signature)
        signature = odoo.tools.misc.hmac(request.env(su=True), 'mail_client_extension', data).encode()
        if not hmac.compare_digest(auth_code_signature, signature):
            return None

        auth_message = json.loads(data)
        # Check the expiration
        if datetime.datetime.utcnow() - datetime.datetime.fromtimestamp(auth_message['timestamp']) > datetime.timedelta(
                minutes=3):
            return None

        return auth_message

    # Using UTC explicitly in case of a distributed system where the generation and the signature verification do not
    # necessarily happen on the same server
    def _generate_auth_code(self, scope, name):
        auth_dict = {
            'scope': scope,
            'name': name,
            'timestamp': int(datetime.datetime.utcnow().timestamp()),
            # <- elapsed time should be < 3 mins when verifying
            'uid': request.uid,
        }
        auth_message = json.dumps(auth_dict, sort_keys=True).encode()
        signature = odoo.tools.misc.hmac(request.env(su=True), 'mail_client_extension', auth_message).encode()
        auth_code = "%s.%s" % (base64.b64encode(auth_message).decode(), base64.b64encode(signature).decode())
        _logger.info('Auth code created - user %s, scope %s', request.env.user, scope)
        return auth_code

    def _iap_enrich(self, domain):
        enriched_data = {}
        try:
            response = request.env['iap.enrich.api']._request_enrich({domain: domain})  # The key doesn't matter
        # except odoo.addons.iap.models.iap.InsufficientCreditError as ice:
        except iap_tools.InsufficientCreditError:
            enriched_data['enrichment_info'] = {'type': 'insufficient_credit',
                                                'info': request.env['iap.account'].get_credits_url('reveal')}
        except Exception as e:
            enriched_data["enrichment_info"] = {'type': 'other', 'info': 'Unknown reason'}
        else:
            enriched_data = response.get(domain)
            if not enriched_data:
                enriched_data = {'enrichment_info': {'type': 'no_data',
                                                     'info': 'The enrichment API found no data for the email provided.'}}
        return enriched_data

    def _find_existing_company(self, normalized_email):
        sender_domain = normalized_email.split('@')[1]
        search = sender_domain if sender_domain not in iap_tools._MAIL_DOMAIN_BLACKLIST else normalized_email
        return request.env['res.partner'].search([('is_company', '=', True), ('email', '=ilike', '%' + search)],
                                                 limit=1)

    def _prepare_company_values(self, company):
        if not company:
            return {'id': -1}

        return {
                    'id': company.id,
                    'name': company.name,
                    'phone': company.phone,
                    'mobile': company.mobile,
                    'email': company.email,
                    'image': company.image_1920,
                    'address': {
                        'street': company.street,
                        'city': company.city,
                        'zip': company.zip,
                        'country': company.country_id.name if company.country_id else ''
                    },
                    'website': company.website,
                    'additionalInfo': json.loads(company.iap_enrich_info) if company.iap_enrich_info else {}
                }

    def _create_company_from_iap(self, domain):
        iap_data = self._iap_enrich(domain)
        if 'enrichment_info' in iap_data:
            return None, iap_data['enrichment_info']

        phone_numbers = iap_data.get('phone_numbers')
        emails = iap_data.get('email')
        new_company_info = {
            'is_company': True,
            'name': iap_data.get("name") or domain,
            'street': iap_data.get("street_name"),
            'city': iap_data.get("city"),
            'zip': iap_data.get("postal_code"),
            'phone': phone_numbers[0] if phone_numbers else None,
            'website': iap_data.get("domain"),
            'email': emails[0] if emails else None
        }

        logo_url = iap_data.get('logo')
        if logo_url:
            try:
                response = requests.get(logo_url, timeout=2)
                if response.ok:
                    new_company_info['image_1920'] = base64.b64encode(response.content)
            except Exception as e:
                _logger.warning('Download of image for new company %r failed, error %r' % (new_company_info.name, e))

        if iap_data.get('country_code'):
            country = request.env['res.country'].search([('code', '=', iap_data['country_code'].upper())])
            if country:
                new_company_info['country_id'] = country.id
                if iap_data.get('state_code'):
                    state = request.env['res.country.state'].search([
                        ('code', '=', iap_data['state_code']),
                        ('country_id', '=', country.id)
                    ])
                    if state:
                        new_company_info['state_id'] = state.id

        new_company_info['iap_enrich_info'] = json.dumps(iap_data)
        new_company = request.env['res.partner'].create(new_company_info)
        new_company.message_post_with_view(
            'iap_mail.enrich_company',
            values=iap_data,
            subtype_id=request.env.ref('mail.mt_note').id,
        )

        return new_company, {'type': 'company_created'}

    def _prepare_partner_values(self, partner):
        return {
            'id': partner.id,
            'name': partner.name,
            'title': partner.function,
            'email': partner.email,
            'image': partner.image_128,
            'phone': partner.phone,
            'mobile': partner.mobile,
            'enrichment_info': None,
        }

    def _prepare_contact_values(self, partner):
        """
        method used to return partner related values, it can be overridden by other modules if extra information have to
        be returned with the partner (e.g., leads, ...)
        """
        if partner:
            partner_response = self._prepare_partner_values(partner)
            if partner.company_type == 'company':
                partner_response['company'] = self._prepare_company_values(partner)
            else:
                if partner.parent_id:
                    partner_response['company'] = self._prepare_company_values(partner.parent_id)
                else:
                    partner_response['company'] = self._prepare_company_values(None)
        else:  # no partner found
            partner_response = {}

        return {'partner': partner_response}

    def _mail_content_logging_models_whitelist(self):
        """
        Returns all models that emails can be logged to and that can be used by the "log_mail_content" method,
        it can be overridden by sub modules in order to whitelist more models
        """
        return ['res.partner']
