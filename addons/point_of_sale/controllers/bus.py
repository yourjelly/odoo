# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.http import request
from odoo.addons.bus.controllers.main import BusController


class PosBusController(BusController):

    # --------------------------
    # Extends BUS Controller Poll
    # --------------------------
    def _poll(self, dbname, channels, last, options):
        channels = list(channels)
        if options.get('has_open_pos_session'):
            pos_session = request.env['pos.session'].browse(options.get('pos_session_id'))
            # /?\ What if the session is closed?
            if pos_session:
                channels.append(pos_session)
        return super()._poll(dbname, channels, last, options)
