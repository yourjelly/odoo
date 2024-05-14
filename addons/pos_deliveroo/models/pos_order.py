from odoo import models, fields
import pytz

class PosOrder(models.Model):
    _inherit = 'pos.order'

    delivery_display = fields.Char('Delivery Display')
    delivery_prepare_for = fields.Datetime('Delivery Prepare For')
    delivery_asap = fields.Boolean('Delivery ASAP', default=True)
    delivery_confirm_at = fields.Datetime('Delivery Confirm At')
    delivery_start_preparing_at = fields.Datetime('Delivery Start Preparing At')

    def _export_for_ui(self, order):
        res = super()._export_for_ui(order)
        timezone = pytz.timezone(self._context.get('tz') or self.env.user.tz or 'UTC')
        res['delivery_display'] = order.delivery_display if order.delivery_display else False
        res['delivery_prepare_for'] = str(order.delivery_prepare_for.astimezone(timezone)) if order.delivery_prepare_for else False
        res['delivery_asap'] = order.delivery_asap
        res['delivery_confirm_at'] = str(order.delivery_confirm_at.astimezone(timezone)) if order.delivery_confirm_at else False
        res['delivery_start_preparing_at'] = str(order.delivery_start_preparing_at.astimezone(timezone)) if order.delivery_start_preparing_at else False
        return res

    def change_order_delivery_status(self, new_status, send_order_count = True):
        super().change_order_delivery_status(new_status, send_order_count)
        if self.delivery_provider_id.code == 'deliveroo':
            match new_status:
                case 'preparing':
                    self.delivery_provider_id._send_preparation_status(self.delivery_id, 'in_kitchen', 0)
                case 'ready':
                    self.delivery_provider_id._send_preparation_status(self.delivery_id, 'ready_for_collection_soon')
                case 'delivered':
                    self.delivery_provider_id._send_preparation_status(self.delivery_id, 'collected')
                case _:
                    pass

    def call_deliveroo_controller(self):
        return {
            'type': 'ir.actions.act_url',
            'url': '/pos_deliveroo/order',
        }

    # def test(self):
    #     dummy_order_data = {
    #         "body": {
    #             "order": {
    #                 "id": "123456789",
    #                 "location_id": "987654321",
    #                 "status": "pending",  # Order status
    #                 "asap": True,  # Whether the order is as soon as possible
    #                 "confirm_at": "2024-05-14T12:00:00",  # Confirmation time
    #                 "start_preparing_at": "2024-05-14T11:45:00",  # Time when preparation starts
    #                 "prepare_for": "2024-05-14T12:30:00",  # Time to prepare for
    #                 "partner_order_total": 25.99,  # Total order amount
    #                 "cash_due": 0.0,  # Amount due in cash
    #                 "display_id": "ROO123456",  # Order display ID
    #                 "order_notes": "Extra sauce, no onions",  # Additional notes for the order
    #                 "cutlery_notes": "No cutlery required",  # Notes regarding cutlery
    #                 "items": [  # List of items in the order
    #                     {
    #                         "pos_item_id": 1,  # ID of the item in the POS system
    #                         "quantity": 2,  # Quantity of the item
    #                         "unit_price": 8.99,  # Unit price of the item
    #                         "menu_unit_price": 9.99  # Unit price of the item as per the menu
    #                         # Add more items if required
    #                     },
    #                     {
    #                         "pos_item_id": 2,
    #                         "quantity": 1,
    #                         "unit_price": 6.99,
    #                         "menu_unit_price": 7.99
    #                     }
    #                     # Add more items if required
    #                 ]
    #             }
    #         }
    #     }
