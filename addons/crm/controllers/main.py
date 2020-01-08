# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging

from odoo.addons.mail.controllers.main import MailController
from odoo import http, _

from odoo.http import request
from werkzeug import exceptions
from hashlib import sha256
import json
import base64
import odoo

_logger = logging.getLogger(__name__)


class CrmController(http.Controller):

    @http.route('/lead/case_mark_won', type='http', auth='user', methods=['GET'])
    def crm_lead_case_mark_won(self, res_id, token):
        comparison, record, redirect = MailController._check_token_and_record_or_redirect('crm.lead', int(res_id), token)
        if comparison and record:
            try:
                record.action_set_won()
            except Exception:
                _logger.exception("Could not mark crm.lead as won")
                return MailController._redirect_to_messaging()
        return redirect

    @http.route('/lead/case_mark_lost', type='http', auth='user', methods=['GET'])
    def crm_lead_case_mark_lost(self, res_id, token):
        comparison, record, redirect = MailController._check_token_and_record_or_redirect('crm.lead', int(res_id), token)
        if comparison and record:
            try:
                record.action_set_lost()
            except Exception:
                _logger.exception("Could not mark crm.lead as lost")
                return MailController._redirect_to_messaging()
        return redirect

    @http.route('/lead/convert', type='http', auth='user', methods=['GET'])
    def crm_lead_convert(self, res_id, token):
        comparison, record, redirect = MailController._check_token_and_record_or_redirect('crm.lead', int(res_id), token)
        if comparison and record:
            try:
                record.convert_opportunity(record.partner_id.id)
            except Exception:
                _logger.exception("Could not convert crm.lead to opportunity")
                return MailController._redirect_to_messaging()
        return redirect


########################################################################################################################
    @http.route('/login_add_ons', type='http', auth="none")#methods=["POST"],
    def web_login(self, redirect=None, **kw):
        request.params['login_success'] = False

        # if request.httprequest.method == 'GET' and redirect_uri and request.session.uid:
        #     return http.redirect_with_hash(redirect_uri)

        if not request.uid:
            request.uid = odoo.SUPERUSER_ID

        values = request.params.copy()
        try:
            values['databases'] = http.db_list()
        except odoo.exceptions.AccessDenied:
            values['databases'] = None

        if request.httprequest.method == 'POST':
            old_uid = request.uid
            try:
                uid = request.session.authenticate(request.session.db, request.params['login'], request.params['password'])
                request.params['login_success'] = True
                secret = request.env['ir.config_parameter'].sudo().get_param('database.secret')
                hashed_secret = sha256(secret.encode('utf-8'))
                code = "%s.%s" % (hashed_secret.hexdigest(), uid)
                redirect = "%s?success=1&response_type=%s&state=%s&code=%s" % (redirect, kw.get('response_type'), kw.get('state'), code)
                return http.redirect_with_hash(redirect)
            except odoo.exceptions.AccessDenied as e:
                request.uid = old_uid
                if e.args == odoo.exceptions.AccessDenied().args:
                    values['error'] = _("Wrong login/password")
                else:
                    values['error'] = e.args[0]
        else:
            if 'error' in request.params and request.params.get('error') == 'access':
                values['error'] = _('Only employee can access this database. Please contact the administrator.')

        if 'login' not in values and request.session.get('auth_login'):
            values['login'] = request.session.get('auth_login')

        if not odoo.tools.config['list_db']:
            values['disable_database_manager'] = True

        response = request.render('crm.login_add_ons', values)
        response.headers['X-Frame-Options'] = 'DENY'
        return response

    @http.route('/token_add_ons', type='http', csrf=False, auth="none", cors="*")
    def exchange_code_with_token(self, **kw):
        code = request.params['code'].split('.')
        request_secret = code[0]
        request_uid = code[-1]
        database_secret = request.env['ir.config_parameter'].sudo().get_param('database.secret')
        signature = sha256(database_secret.encode('utf-8')).hexdigest()
        if signature != request_secret:
            return json.dumps({
                "error": "Invalid code",
            })

        # GENERATE TOKEN
        header = json.dumps({
            "alg": "SHA256",
            "typ": "JWT"
        }).encode()
        payload = json.dumps({
            "user_id": 1,
        }).encode()
        encoded_string = "%s.%s" % (base64.b64encode(header), base64.b64encode(payload))
        return json.dumps({
            "access_token": encoded_string + "." + signature,
            "expires_in": 2592000
        })

    @http.route('/get_email_info', type="http", auth="gmail", csrf=False, cors="*")
    def get_email_info(self, email):
        partner = request.env['res.partner'].sudo().search([('email', '=', email)], limit=1)
        #if not partner:
        #    partner = request.env['res.partner'].sudo().create({
        #        'email': email,
        #        'name': "test name" #request.params.get('partner_name', False)
        #    })
        #request.params['partner_id'] = partner.id
        if not partner:
            return json.dumps({})

        lead_count = request.env['crm.lead'].sudo().search_count([('partner_id', '=', partner[0].id)])
        return json.dumps({
            "name": partner.name,
            "email": partner.email,
            "street": partner.street,
            "street2": partner.street2,
            "city": partner.city,
            "leadCount": lead_count
        })

    @http.route('/partner/get', type="json", auth="gmail", csrf=False, cors="*")
    def res_partner_get_by_email(self,  **kwargs):
        email = request.jsonrequest.get("email")
        name = request.jsonrequest.get("name")
        partner = request.env['res.partner'].with_user(request.env.user).search([('email', '=', email)])
        partner_created = False
        if not partner:
            partner = request.env['res.partner'].with_user(request.env.user).create({
                'name': name,
                'email': email,
                #'parent_id': request.env['res.partner'].with_user(request.env.user).search([('name', '=', 'Odoo')])[0].id
            })
            partner_created = True

            # TODO: CLEARBIT ENRICHMENT IMPLEMENTATION

        return {
            'id': partner.id,
            'name': partner.name,
            'address': {
                'street': partner.street,
                'city': partner.city,
                'zip': partner.zip,
                'country': partner.country_id.name
            },
            'title': partner.function,
            'phone': partner.phone,
            'mobile': partner.mobile,
            'email': partner.email,
            'image': partner.image_128,
            'created': partner_created,
            'company': {
                'id': partner.parent_id.id,
                'name': partner.parent_name,
                'employees': 500,
                'type': 'ASBL',
                'raised': '$2M',
                'markets': 'Saas',
                'website': partner.parent_id.website,
                'image': partner.parent_id.image_128
            }
        }

    @http.route('/log_single_mail_content', type="json", auth="gmail", csrf=False, cors="*")
    def log_single_mail_content(self, model, partner_id, record_id, message, **kw):
        record = request.env[model].with_user(request.env.user).browse(int(record_id))
        record._message_log(body=message, author_id=int(partner_id))
        return {
            'success': True
        }

    def get_leads_for_partner_id(self, request, id):
        partner_leads = request.env['crm.lead'].with_user(request.env.user).search([('partner_id', '=', id)])
        leads = []
        for lead in partner_leads:
            leads.append({
                'id': lead.id,
                'name': lead.name,
                'expected_revenue': str(lead.expected_revenue),
                'planned_revenue': str(lead.planned_revenue),
                'currency_symbol': lead.company_currency.symbol
            })
        return leads

    @http.route('/lead/get_by_partner_id', type="json", auth="gmail", csrf=False, cors="*")
    def crm_lead_get_by_partner_id(self, **kwargs):
        partner_id = request.jsonrequest.get("partner_id")
        return {'leads': self.get_leads_for_partner_id(request, partner_id)}


    @http.route('/lead/create', type="json", auth="gmail", csrf=False, cors="*")
    def crm_lead_create(self, **kwargs):
        lead_values = request.jsonrequest#.get("lead_values")
        lead = request.env['crm.lead'].with_user(request.env.user).create({
            'name': lead_values['name'],
            'partner_id': int(lead_values['partner_id']),
            'planned_revenue': int(lead_values['expected_revenue']),
            'priority': lead_values['priority']
        })

        return {
            'success': True if lead else False
        }

    @http.route('/lead/delete', type="json", auth="gmail", csrf=False, cors="*")
    def crm_lead_delete(self, **kwargs):
        lead_id = request.jsonrequest.get("id")
        lead = request.env['crm.lead'].with_user(request.env.user).search([('id', '=', lead_id)])
        if not lead:
            return {
                'success': False
            }

        partner_id = lead.partner_id.id
        lead.unlink()

        return {
            'success': True,
            'leads': self.get_leads_for_partner_id(request, partner_id)
        }

    @http.route('/crm/test', type="json", auth="public", csrf=False, cors="*")
    def crm_test(self, **kwargs):

        return {
            'success': True
        }


    @http.route('/crm/testhtml', type="http", auth="public", csrf=False, cors="*")
    def crm_testhtml(self, **kwargs):
        r = request.params
        return json.dumps({
            'success': True
        })