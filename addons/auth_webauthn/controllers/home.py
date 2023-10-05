from base64 import b64encode, b64decode
from odoo import _, http
from odoo.addons.web.controllers import home as web_home
from odoo.exceptions import ValidationError
from odoo.http import request
from urllib.parse import urlparse
from webauthn import generate_authentication_options, options_to_json, verify_authentication_response
from webauthn.helpers.structs import UserVerificationRequirement, AuthenticationCredential

TRUSTED_DEVICE_COOKIE = 'td_id'
TRUSTED_DEVICE_AGE = 90*86400 # 90 days expiration

class Home(web_home.Home):
    @http.route('/web/login/webauthn', 
            type='http', auth='public', methods=['GET'], sitemap=False, 
            website=True, multilang=False)
    def web_webauthn(self, redirect=None, **kwargs):
        if request.session.uid:
            return request.redirect(self._login_redirect(request.session.uid, redirect=redirect))

        if not request.session.pre_uid:
            return request.redirect('/web/login')

        return request.render('auth_webauthn.auth_webauthn_form');
    
    @http.route('/web/login/webauthn/challenge', type='json', auth='public', methods=['POST'], sitemap=False)
    def webauthn_challenge(self, redirect=None, **kwargs):
        webauthn_ids = request.env['auth_webauthn.wizard'].sudo().search([('user_id', '=', request.session.pre_uid)])
        options = generate_authentication_options(
            rp_id=urlparse(request.env["ir.config_parameter"].sudo().get_param("web.base.url")).netloc,
            allow_credentials=[
                {"type": "public-key", "id": record.credential_id}
                for record in webauthn_ids
            ],
            user_verification=UserVerificationRequirement.REQUIRED
        )

        request.env['res.users'].sudo().browse(request.session.pre_uid).webauthn_challenge = b64encode(options.challenge).decode()
        return options_to_json(options)

    @http.route('/web/login/webauthn/verify/<string:credential>', 
            type='http', auth='public', methods=['GET'], sitemap=False, 
            website=True, multilang=False)
    def webauthn_verify(self, credential, redirect=None, **kwargs):
        creds = AuthenticationCredential.model_validate_json(credential)
        user = request.env['res.users'].sudo().browse(request.session.pre_uid)
        webauthn_ids = request.env['auth_webauthn.wizard'].sudo().search([('user_id', '=', request.session.pre_uid)])

        user_credential = None

        for record in webauthn_ids:
            if record.credential_id == creds.raw_id:
                user_credential = record

        if user_credential is None:
            raise ValidationError(f"Webauthn couldn't validate your session")

        verif = verify_authentication_response(
            credential=creds,
            expected_challenge=b64decode(user.webauthn_challenge.encode()),    
            expected_rp_id=urlparse(request.env["ir.config_parameter"].sudo().get_param("web.base.url")).netloc.split(":")[0],
            expected_origin=request.env["ir.config_parameter"].sudo().get_param("web.base.url"),
            require_user_verification=True,
            credential_public_key=user_credential.public_key,
            credential_current_sign_count=user_credential.sign_count,
        )

        user_credential.sign_count = verif.new_sign_count
        request.session.finalize(request.env)
        request.update_env(user=request.session.uid)
        request.update_context(**request.session.context)
        response = request.redirect(self._login_redirect(request.session.uid, redirect=redirect))

        if request.geoip.city.name:
            name += f" ({request.geoip.city.name}, {request.geoip.country_name})"

        response.set_cookie(
            key=TRUSTED_DEVICE_COOKIE,
            max_age=TRUSTED_DEVICE_AGE,
            httponly=True,
            samesite='Lax'
        )

        # Crapy workaround for unupdatable Odoo Mobile App iOS (Thanks Apple :@)
        request.session.touch()
        return response


