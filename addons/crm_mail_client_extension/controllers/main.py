# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging
import werkzeug

from odoo import http
from odoo.http import request
from odoo.tools.misc import formatLang
from odoo.tools import html2plaintext

from odoo.addons.mail_client_extension.controllers import main

_logger = logging.getLogger(__name__)


class MailClientExtensionController(main.MailClientExtensionController):

    @http.route(route='/mail_client_extension/log_single_mail_content',
                type="json", auth="outlook", cors="*")
    def log_single_mail_content(self, lead, message, **kw):
        """
            deprecated as of saas-14.3, not needed for newer versions of the mail plugin but necessary
            for supporting older versions
        """
        crm_lead = request.env['crm.lead'].browse(lead)
        crm_lead.message_post(body=message)

    @http.route('/mail_client_extension/lead/get_by_partner_id', type="json", auth="outlook", cors="*")
    def crm_lead_get_by_partner_id(self, partner, limit=5, offset=0, **kwargs):
        """
            deprecated as of saas-14.3, not needed for newer versions of the mail plugin but necessary
            for supporting older versions
        """
        return {'leads': self._fetch_partner_leads(partner, limit, offset)}

    @http.route('/mail_client_extension/lead/create_from_partner', type='http', auth='user', methods=['GET'])
    def crm_lead_redirect_create_form_view(self, partner_id):
        """
            deprecated as of saas-14.3, not needed for newer versions of the mail plugin but necessary
            for supporting older versions
        """
        server_action = http.request.env.ref("crm_mail_client_extension.lead_creation_prefilled_action")
        return werkzeug.utils.redirect('/web#action=%s&model=crm.lead&partner_id=%s' % (server_action.id, int(partner_id)))

    @http.route('/mail_client_extension/lead/create', type='json', auth='outlook', cors="*")
    def crm_lead_create(self, partner_id, email_body, email_subject):
        partner = request.env['res.partner'].browse(partner_id).exists()
        if not partner:
            return {'error': 'partner_not_found'}

        record = request.env['crm.lead'].create({
            'name': html2plaintext(email_subject),
            'partner_id': partner_id,
            'description': html2plaintext(email_body),
        })

        return {'lead_id': record.id}

    @http.route('/mail_client_extension/lead/open', type='http', auth='user')
    def crm_lead_open(self, lead_id):
        action = http.request.env.ref("crm.crm_lead_view_form")
        url = '/web#id=%s&action=%s&model=crm.lead&edit=1&model=crm.lead' % (lead_id, action.id)
        return werkzeug.utils.redirect(url)

    def _fetch_partner_leads(self, partner, limit=5, offset=0):
        """
        Returns an array containing partner leads, each lead will have the following structure :
        {
            id: the lead's id,
            name: the lead's name,
            expected_revenue: the expected revenue field value
            probability: the value of the probability field,
            recurring_revenue: the value of the recurring_revenue field if the lead has a recurring revenue
            recurring_plan: the value of the recurring plan field if the lead has a recurring revenue
        }
        """

        partner_leads = request.env['crm.lead'].search(
            [('partner_id', '=', partner.id)], offset=offset, limit=limit)
        recurring_revenues = request.env.user.has_group('crm.group_use_recurring_revenues')

        leads = []
        for lead in partner_leads:
            lead_values = {
                'id': lead.id,
                'name': lead.name,
                'expected_revenue': formatLang(request.env, lead.expected_revenue, monetary=True,
                                               currency_obj=lead.company_currency),
                'probability': lead.probability,
            }

            if recurring_revenues:
                lead_values.update({
                    'recurring_revenue': formatLang(request.env, lead.recurring_revenue, monetary=True,
                                                    currency_obj=lead.company_currency),
                    'recurring_plan': lead.recurring_plan.name,
                })

            leads.append(lead_values)

        return leads

    def _prepare_contact_values(self, partner):
        contact_values = super(MailClientExtensionController, self)._prepare_contact_values(partner)
        if not partner:
            contact_values['leads'] = []
        else:
            contact_values['leads'] = self._fetch_partner_leads(partner)
        return contact_values

    def _mail_content_logging_models_whitelist(self):
        return super(MailClientExtensionController, self)._mail_content_logging_models_whitelist() + ['crm.lead']
