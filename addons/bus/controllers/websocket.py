# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.http import Controller, request, route
from odoo.addons.base.models.assetsbundle import AssetsBundle
from ..models.bus import channel_with_db
from ..websocket import WebsocketConnectionHandler


class WebsocketController(Controller):
    @route('/websocket', type="http", auth="public", websocket=True)
    def websocket(self):
        """
        Handle the websocket handshake, upgrade the connection if
        successfull.
        """
        return WebsocketConnectionHandler.open_connection(request)

    @route('/websocket/peek_notifications', type='json', auth='public', cors='*')
    def peek_notifications(self, channels, last):
        channels = list(set(
            channel_with_db(request.db, c)
            for c in request.env['ir.websocket']._build_websocket_channel_list(channels)
        ))
        notifications = request.env['bus.bus']._poll(channels, last)
        return {'channels': channels, 'notifications': notifications}

    @route('/websocket/update_bus_presence', type='http', auth='public', cors='*')
    def update_bus_presence(self, inactivity_period):
        request.env['ir.websocket']._update_bus_presence(inactivity_period)

    @route('/bus/websocket_worker_bundle', type='http', auth='public')
    def get_websocket_worker_bundle(self):
        bundle = 'bus.websocket_worker_assets'
        files, _ = request.env["ir.qweb"]._get_asset_content(bundle)
        asset = AssetsBundle(bundle, files)
        stream = request.env['ir.binary']._get_stream_from(asset.js())
        return stream.get_response()
