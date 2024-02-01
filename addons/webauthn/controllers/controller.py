from odoo import http
from odoo.http import request, route
from odoo.addons.web.controllers.utils import _get_login_redirect_url
from ..lib.duo_labs.webauthn import base64url_to_bytes, generate_authentication_options, verify_authentication_response, generate_registration_options, verify_registration_response, options_to_json
from ..lib.duo_labs.webauthn.helpers.structs import AuthenticatorSelectionCriteria, ResidentKeyRequirement
from base64 import urlsafe_b64encode
import json


class WebauthnController(http.Controller):
    @http.route(['/auth/passkey/start-registration'], type='http', auth='public')
    def json_start_registration(self):
        base_url = request.env['ir.config_parameter'].sudo().get_param('web.base.url')
        registration_options = generate_registration_options(
            rp_id=base_url.split("/")[2].split(":")[0],
            rp_name="Odoo",
            user_id=request.session.uid.to_bytes(4, "big"),
            user_name=request.session.login,
            authenticator_selection=AuthenticatorSelectionCriteria(resident_key=ResidentKeyRequirement.REQUIRED)
        )
        request.session.webauthn_challenge = registration_options.challenge
        return request.make_json_response(json.loads(options_to_json(registration_options)))
    
    @http.route(['/auth/passkey/verify-registration'], type='http', auth='public', csrf=False)
    def json_verify_registration(self):
        base_url = request.env['ir.config_parameter'].sudo().get_param('web.base.url')
        domain = base_url.split("/")[2]
        protocol = base_url.split("/")[0]
        verification = verify_registration_response(
            credential=request.httprequest.get_json(),
            expected_challenge=request.session.webauthn_challenge,
            expected_origin=protocol + "//" + domain,
            expected_rp_id=domain.split(":")[0],
        )
        return request.make_json_response({"credentialId": urlsafe_b64encode(verification.credential_id),
                                           "credentialPublicKey": urlsafe_b64encode(verification.credential_public_key)})


    @http.route(['/auth/passkey/start-auth'], type='http', auth='public')
    def json_start_authentication(self):
        base_url = request.env['ir.config_parameter'].sudo().get_param('web.base.url')
        auth_options = generate_authentication_options(
            rp_id=base_url.split("/")[2].split(":")[0],
        )
        request.session.webauthn_challenge = auth_options.challenge
        return request.make_json_response(json.loads(options_to_json(auth_options)))

    @http.route(['/auth/passkey/verify-auth'], type='http', auth='public', csrf=False)
    def json_verify_authentication(self):
        base_url = request.env['ir.config_parameter'].sudo().get_param('web.base.url')
        domain = base_url.split("/")[2]
        protocol = base_url.split("/")[0]
        webauthn_id = request.httprequest.get_json()["id"]
        auth_key = request.env["webauthn.key"]._get_nopw_user_by_id(webauthn_id)
        if auth_key:
            auth_verification = verify_authentication_response(
                credential=request.httprequest.get_json(),
                expected_challenge=request.session.webauthn_challenge,
                expected_origin=protocol + "//" + domain,
                expected_rp_id=domain.split(":")[0],
                credential_public_key=base64url_to_bytes(auth_key.public_key),
                credential_current_sign_count = auth_key.sign_count,
            )
            auth_key.sign_count = auth_verification.new_sign_count
            request.session.pre_login = auth_key.create_uid.login
            request.session.pre_uid = auth_key.create_uid.id
            request.session.finalize(request.env)
            return request.make_json_response({"status":"ok", "redirect_url": _get_login_redirect_url(auth_key.create_uid.id)})
        else:
            return request.make_json_response({"status":"fail"})
