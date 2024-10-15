# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.addons import base, bus


class ResUsersSettings(base.ResUsersSettings, bus.BusListenerMixin):

    def _bus_channel(self):
        return self.user_id._bus_channel()
