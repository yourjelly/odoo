from odoo import api, fields, models
from collections import defaultdict


class PosConfig(models.Model):
    _inherit = "pos.config"

    delivery_provider_ids = fields.Many2many('pos.online.delivery.provider', 'pos_config_delivery_provider_rel', 'config_id', 'delivery_provider_id', string='Delivery Provider')

    def _send_delivery_order_count(self, order_id):
        print("self========================",self.current_session_id)
        order_count = self.get_delivery_order_count()
        if self.current_session_id:
            self._notify('DELIVERY_ORDER_COUNT', order_count, private=False)

    def get_delivery_order_count(self):
        records = self.env['pos.order'].search([('brand_id', '!=', False)])
        brand_stages = defaultdict(lambda: defaultdict(int))
        for record in records:
            brand_id = record.brand_id
            delivery_status = record.delivery_status.lower()  # Convert status to lowercase for consistency
            brand_stages[brand_id][delivery_status] += 1

        # Prepare the final output
        output = []

        # Iterate through the defaultdict to create the desired format
        for brand, delivery_status in brand_stages.items():
            # Convert the delivery_status defaultdict to a regular dictionary
            delivery_status_dict = dict(delivery_status)
            # Capitalize brand name and append to output
            output.append({brand.capitalize(): delivery_status_dict})

        print(output)
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
        brand_ids = set(self.env['pos.order'].search([('brand_id', '!=', False)]).mapped('brand_id'))
        order_count = defaultdict(lambda: defaultdict(int))

        for brand_id in brand_ids:
            orders = self.env['pos.order'].search([
                ('delivery_id', '!=', False),
                ('brand_id', '=', brand_id),
                ('config_id', '=', self.id)  # Filter orders for the current config
            ])

            # Check if there are any orders for the current brand and config
            if orders:
                order_count[brand_id] = {
                    'awaiting': len(orders.filtered(lambda r: r.delivery_status == 'awaiting')),
                    'scheduled': len(orders.filtered(lambda r: r.delivery_status in ['scheduled', 'confirmed'])),
                    'preparing': len(orders.filtered(lambda r: r.delivery_status == 'preparing'))
                }

        return order_count
