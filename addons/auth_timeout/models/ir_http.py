import logging
import time

from odoo import api, models
from odoo.http import request, SessionExpiredException

ROUTES_NO_CHECK_IDENTITY = [
    ('odoo.addons.web.controllers.home', 'Home.web_load_menus'),
]


class CheckIdentityException(SessionExpiredException):
    # To log only with debug level in odoo/http.py Application.__call__
    loglevel = logging.DEBUG


class IrHttp(models.AbstractModel):
    _inherit = 'ir.http'

    @classmethod
    def _authenticate(cls, endpoint):
        super()._authenticate(endpoint)
        if (
            endpoint.routing['auth'] == "user"
            and (endpoint.__module__, endpoint.__qualname__) not in ROUTES_NO_CHECK_IDENTITY
        ):
            session = request.session
            if (
                session.get('identity-check-next') and session['identity-check-next'] < time.time()
                or (
                    request.env.user.lock_timeout
                    and session.get('identity-check-last', 0) < time.time() - request.env.user.lock_timeout * 60
                )
            ):
                raise CheckIdentityException(
                    f"User {session.uid} needs to confirm his identity",
                    request.env.user._get_auth_methods(),
                )

    @classmethod
    def _handle_error(cls, exception):
        if request.dispatcher.routing_type == 'http' and isinstance(exception, CheckIdentityException):
            response = request.redirect_query(
                '/auth-timeout/check-identity',
                {'redirect': request.httprequest.full_path}
            )
            return response
        return super()._handle_error(exception)

    def _session_info_common_auth_timeout(self, session_info):
        if not self.env.user._is_public() and self.env.user.lock_timeout_inactivity:
            session_info["lock_timeout_inactivity"] = self.env.user.lock_timeout_inactivity
        return session_info

    def session_info(self):
        session_info = super().session_info()
        return self._session_info_common_auth_timeout(session_info)

    @api.model
    def get_frontend_session_info(self):
        session_info = super().get_frontend_session_info()
        session_info = self._session_info_common_auth_timeout(session_info)
        # By default, user name and login are only put in the backend session info
        # It's needed for the front-end as well for the check identity dialog, to display the "Signed in as ..."
        # We should consider to put this by default in the base `get_frontend_session_info`
        if not self.env.user._is_public():
            session_info.update({
                "name": self.env.user.name,
                "username": self.env.user.login,
            })
        return session_info
