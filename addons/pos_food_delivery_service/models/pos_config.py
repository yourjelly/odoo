from odoo import api, fields, models


class PosConfig(models.Model):
    _inherit = "pos.config"

    delivery_provider_ids = fields.Many2many('pos.online.delivery.provider', 'pos_config_delivery_provider_rel', 'config_id', 'delivery_provider_id', string='Delivery Provider')

    def _send_delivery_order_count(self, order_id):
        print("self========================",self.current_session_id)
        order_count = self.get_delivery_order_count()
        if self.current_session_id:
            self._notify('DELIVERY_ORDER_COUNT', order_count, private=False)

    def get_delivery_order_count(self):
        # overriden by delivery_provider modules
        # should return a dict with the count of delivery orders for each delivery service
        # like
        # {
        #   'deliveroo': {
        #       'awaiting': 2,
        #       'preparing': 1
        #   },
        #   'ubereats': {
        #       'awaiting': 1
        #   }
        # }
        res = {}
        res['urbanpiper'] = self.get_urbanpiper_order_count()
        return res

    def get_urbanpiper_order_count(self):
        if not self.current_session_id:
            return {
                'awaiting': 0,
                'preparing': 0,
            }
        order_count = {
            'awaiting': self.env['pos.order'].search_count(
                [('session_id', '=', self.current_session_id.id), ('delivery_id', '!=', False),
                 ('delivery_status', '=', 'awaiting')]),
            'scheduled': self.env['pos.order'].search_count(
                [('session_id', '=', self.current_session_id.id), ('delivery_id', '!=', False),
                 ('delivery_status', 'in', ['scheduled', 'confirmed'])]),
            'preparing': self.env['pos.order'].search_count(
                [('session_id', '=', self.current_session_id.id), ('delivery_id', '!=', False),
                 ('delivery_status', '=', 'preparing')]),
        }
        return order_count