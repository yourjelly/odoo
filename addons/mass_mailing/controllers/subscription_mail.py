# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import base64

import werkzeug
from odoo import _, exceptions, http
from odoo.http import route, request
from odoo.tools import consteq


class SubscriptionController(http.Controller):
    @route('/mail/mailing/<int:mailing_id>/accept', type='http', website=True, auth='public')
    def accept_subscription(self, mailing_id, email=None, res_id=None, token="", **post):
        return self.update_subscription(mailing_id, email, res_id, token, 'accept')

    @route('/mail/mailing/<int:mailing_id>/decline', type='http', website=True, auth='public')
    def decline_subscription(self, mailing_id, email=None, res_id=None, token="", **post):
        return self.update_subscription(mailing_id, email, res_id, token, 'decline')

    def update_subscription(self, mailing_id, email, res_id, token, mode):
        mailing = request.env['mail.mass_mailing.subscription_mail'].sudo().browse(mailing_id)

        res_ids = [mailing.list_contact_id.list_id.id]
        right_token = mailing._get_token(res_id, email)
        if not consteq(str(token), right_token):
            raise exceptions.AccessDenied()
        mailing.update_subscription_state(email, res_ids, True if mode == 'decline' else False, mailing_id)

        contact = request.env['mail.mass_mailing.contact'].sudo().search([('email', '=ilike', email)])
        opt_out_list_ids = contact.opt_out_list_ids.filtered(lambda rel: rel.state != 'confirmed').mapped('list_id')
        page = 'mass_mailing.page_decline_subscription' if mode == 'decline' else 'mass_mailing.page_accept_subscription'
        return request.render(page, {
            'email': email,
            'mailing_id': mailing_id,
            'current_list_id': mailing.list_contact_id.list_id,
            'list_ids': contact.list_ids,
            'opt_out_list_ids': opt_out_list_ids,
            'contact': contact
        })

    @route('/mail/mailing/update_subscriptions', type='json', auth='none')
    def update_subscriptions(self, mailing_id, opt_in_ids, opt_out_ids, email):
        mailing = request.env['mail.mass_mailing.subscription_mail'].sudo().browse(mailing_id)
        if mailing.exists():
            mailing.update_subscription_state(email, opt_in_ids, False)
            mailing.update_subscription_state(email, opt_out_ids, True)
