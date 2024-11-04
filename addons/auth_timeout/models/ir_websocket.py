import time

from odoo import models
from odoo.http import root


class IrWebsocket(models.AbstractModel):
    _inherit = ['ir.websocket']

    def _on_websocket_closed(self, cookies):
        super()._on_websocket_closed(cookies)
        if cookies.get('session_id'):
            session = root.session_store.get(cookies['session_id'])
            if not session.get('identity-check-next') or session['identity-check-next'] > time.time():
                session['identity-check-next'] = time.time() + self.env.user.lock_timeout_inactivity * 60
                # save manually because a websocket request doesn't support automatic save of changes in the session
                # as a normal request does.
                root.session_store.save(session)
