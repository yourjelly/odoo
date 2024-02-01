from odoo import http, _
from odoo.http import request
from odoo.addons.auth_signup.controllers.main import AuthSignupHome


class DisablePasswordReset(AuthSignupHome):
    @http.route()
    def web_auth_reset_password(self, *args, **kw):
        context = self.get_auth_signup_qcontext()
        if context.get('token') and context.get('login'):
            user = request.env["res.users"].sudo().search([('login', '=', context['login'])], limit=1)
            if user.password_login_disabled:
                # Don't allow users to view the reset password page and block the POST request.
                reset_password_disabled = request.env['ir.config_parameter'].sudo().get_param("auth_passkey.reset_password_disabled")
                if not reset_password_disabled:
                    context['error'] = _("Your password login has been disabled. Please use Passkeys to login.")
                    context['invalid_token'] = True
                    return request.render('auth_signup.reset_password', context)

                # They are setting a new password
                if context.get('password'):
                    user.password_login_disabled = False

        return super().web_auth_reset_password(*args, **kw)
