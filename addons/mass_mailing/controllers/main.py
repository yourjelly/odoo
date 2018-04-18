# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import base64

import werkzeug

from odoo import _, exceptions, http
from odoo.http import request
from odoo.tools import consteq


class MassMailController(http.Controller):

    @http.route(['/mail/mailing/<int:mailing_id>/unsubscribe'], type='http', website=True, auth='public')
    def mailing(self, mailing_id, email=None, res_id=None, token="", **post):
        mailing = request.env['mail.mass_mailing'].sudo().browse(mailing_id)
        if mailing.exists():
            res_id = res_id and int(res_id)
            res_ids = []
            right_token = mailing._unsubscribe_token(res_id, email)
            if not consteq(str(token), right_token):
                raise exceptions.AccessDenied()
            if mailing.mailing_model_name == 'mail.mass_mailing.list':
                contact = request.env['mail.mass_mailing.contact'].sudo().browse(res_id)
                return request.render('mass_mailing.unsubscribe', {
                    'res_id': res_id,
                    'token': token,
                    'contact': contact,
                    'email': email,
                    'mailing': mailing})
            else:
                res_ids = [res_id]
                mailing.update_opt_out(email, res_ids, True)
                return request.render('mass_mailing.unsubscribe_success')
        else:
            raise exceptions.AccessError(_('Access Denied'))

    @http.route(['/mail/mailing/unsubscribe'], type='json', methods=['POST'], website=True, auth='public')
    def unsubscribe_mailing(self, **post):
        mailing = request.env['mail.mass_mailing'].sudo().browse(post['mailing_id'])
        if mailing.exists():
            res_id = post['contact_id'] and int(post['contact_id'])
            right_token = mailing._unsubscribe_token(res_id, post['email'])
            if not consteq(str(post['token']), right_token):
                raise exceptions.AccessDenied()
            mailing_contact = request.env['mail.mass_mailing.contact'].sudo().browse(res_id)
            if post['opt_out_ids']:
                mailing_list_names = request.env['mail.mass_mailing.list'].sudo().browse(post['opt_out_ids']).mapped('name')
                mailing_contact.list_ids = [(6, 0, post['opt_in_ids'])]
                message = _('You have unsubscribed %s mailing list.') % ','.join(mailing_list_names)
                mailing_contact._message_log(body=message)
            return True
        else:
            raise exceptions.AccessError(_('Access Denied'))


    @http.route('/mail/track/<int:mail_id>/blank.gif', type='http', auth='none')
    def track_mail_open(self, mail_id, **post):
        """ Email tracking. """
        request.env['mail.mail.statistics'].sudo().set_opened(mail_mail_ids=[mail_id])
        response = werkzeug.wrappers.Response()
        response.mimetype = 'image/gif'
        response.data = base64.b64decode(b'R0lGODlhAQABAIAAANvf7wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==')

        return response

    @http.route('/r/<string:code>/m/<int:stat_id>', type='http', auth="none")
    def full_url_redirect(self, code, stat_id, **post):
        # don't assume geoip is set, it is part of the website module
        # which mass_mailing doesn't depend on
        country_code = request.session.get('geoip', False) and request.session.geoip.get('country_code', False)

        request.env['link.tracker.click'].add_click(code, request.httprequest.remote_addr, country_code, stat_id=stat_id)
        return werkzeug.utils.redirect(request.env['link.tracker'].get_url_from_code(code), 301)
