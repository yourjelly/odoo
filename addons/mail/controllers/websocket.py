from odoo.addons.bus.controllers.websocket import WebsocketController
from odoo.http import request, route, SessionExpiredException


class WebsocketControllerPresence(WebsocketController):
    @route('/websocket/update_bus_presence', type='jsonrpc', auth='public', cors='*')
    def update_bus_presence(self, inactivity_period):
        if 'is_websocket_session' not in request.session:
            raise SessionExpiredException()
        request.env['ir.websocket']._update_bus_presence(int(inactivity_period))
        return {}

    def _get_peek_notifications_data(self, channels, last):
        request.env["ir.websocket"]._dispatch_missed_presences(channels)
        return super()._get_peek_notifications_data(channels, last)
