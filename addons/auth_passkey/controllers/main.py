# Part of Odoo. See LICENSE file for full copyright and licensing details.

import werkzeug

from webauthn import verify_authentication_response
from webauthn.helpers import (
    bytes_to_base64url,
    base64url_to_bytes,
    parse_authentication_credential_json,
)

from odoo import http
from odoo.http import request
from odoo.addons.web.controllers.utils import _get_login_redirect_url


class PasskeyController(http.Controller):
    @http.route('/auth_passkey/signin', type='http', auth='none')
    def signin(self, **kw):
        c = parse_authentication_credential_json(kw.get('cred'))
        # print(c)
        dbname = request.db
        url = '/web'  # we should get the url from the js
        if c.id:
            # print('logging in to', dbname, 'with', c.id)
            # response = c.response
            # client_data_bytes = byteslike_to_bytes(response.client_data_json)
            # client_data = parse_client_data_json(client_data_bytes)
            # print(client_data)
            # import wdb;wdb.set_trace()
            user_cred = request.env['public.key.credential'].sudo().search([('key', '=', c.id)], limit=1)
            auth_verif = verify_authentication_response(
                credential=c,
                expected_challenge=kw.get('ex_challenge').encode('UTF-8'),
                expected_rp_id=kw.get('ex_rpId'),
                expected_origin=kw.get('ex_origin'),
                credential_public_key=base64url_to_bytes(user_cred.public_key),
                credential_current_sign_count=0,
            )

            pre_uid = request.session.authenticate(dbname, user_cred.user_id.login, bytes_to_base64url(auth_verif.credential_id))
            resp = request.redirect(_get_login_redirect_url(pre_uid, url), 303)
            resp.autocorrect_location_header = False

            # Since /web is hardcoded, verify user has right to land on it
            if werkzeug.urls.url_parse(resp.location).path == '/web' and not request.env.user._is_internal():
                resp.location = '/'
            return resp

        return request.redirect("/", 303)

    @http.route('/auth_passkey/signin_json', type='json', auth='none')
    def signin_json(self, **kw):
        return 'ok'
