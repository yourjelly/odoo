import re
import time

from odoo import http
from odoo.http import request


class AuthTimeOutController(http.Controller):
    @http.route("/auth-timeout/check-identity", type="http", auth="public", website=True, sitemap=False)
    def check_identity(self, redirect=None):
        return request.render("auth_timeout.check_identity", {
            "redirect": redirect,
            "auth_methods": request.env.user._get_auth_methods(),
        })

    @http.route("/auth-timeout/session/check-identity", type="jsonrpc", auth="public", readonly=True)
    def check_identity_session(self, **kwargs):
        credential = kwargs
        if credential.get("type") in ["totp", "totp_mail"]:
            # totp doesn't support (yet) `_check_credentials`. Call manually _totp_check.
            self.env.user._totp_check(int(re.sub(r"\s", "", credential["code"])))
        else:
            request.env["res.users"].browse(request.session.uid)._check_credentials(credential, {"interactive": True})
        request.session.pop("identity-check-next", None)
        request.session["identity-check-last"] = time.time()

    @http.route("/auth-timeout/away", type="jsonrpc", auth="public", readonly=True)
    def presence(self):
        request.session["identity-check-next"] = time.time()
        return request.env.user._get_auth_methods()

    @http.route("/auth-timeout/send-totp-mail-code", type="jsonrpc", auth="public")
    def send_totp_mail_code(self):
        self.env.user._send_totp_mail_code()
