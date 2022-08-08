from odoo.addons.bus.controllers.main import BusController


class BusController(BusController):

    def _poll(self, dbname, channels, last, options):
        channels.append("pos_stock_channel")
        return super(BusController, self)._poll(dbname, channels, last, options)
