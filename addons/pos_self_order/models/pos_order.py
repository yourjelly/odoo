# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from typing import Dict

from odoo import models, fields, api


class PosOrderLine(models.Model):
    _inherit = "pos.order.line"

    combo_id = fields.Many2one('product.combo', string='Combo reference')

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if (vals.get('combo_parent_uuid')):
                vals.update([
                    ('combo_parent_id', self.search([('uuid', '=', vals.get('combo_parent_uuid'))]).id)
                ])
            if 'combo_parent_uuid' in vals:
                del vals['combo_parent_uuid']
        return super().create(vals_list)

    def write(self, vals):
        if (vals.get('combo_parent_uuid')):
            vals.update([
                ('combo_parent_id', self.search([('uuid', '=', vals.get('combo_parent_uuid'))]).id)
            ])
        if 'combo_parent_uuid' in vals:
            del vals['combo_parent_uuid']
        return super().write(vals)

class PosOrder(models.Model):
    _inherit = "pos.order"

    table_stand_number = fields.Char(string="Table Stand Number")

    @api.model
    def _load_pos_self_data_domain(self, data):
        return [('id', '=', False)]

    @api.model
    def sync_from_ui(self, orders):
        for order in orders:
            if order.get('id'):
                order_id = order['id']

                if isinstance(order_id, int):
                    old_order = self.env['pos.order'].browse(order_id)
                    if old_order.takeaway:
                        order['takeaway'] = old_order.takeaway

        return super().sync_from_ui(orders)

    def _process_saved_order(self, draft):
        res = super()._process_saved_order(draft)
        self._send_notification(self)
        return res

    @api.model
    def remove_from_ui(self, server_ids):
        order_ids = self.env['pos.order'].browse(server_ids)
        order_ids.state = 'cancel'
        self._send_notification(order_ids)
        return super().remove_from_ui(server_ids)

    def get_order_and_related_data(self):
        return {
            'pos.order': self.read(self._load_pos_self_data_fields(self.config_id.id), load=False),
            'pos.order.line': self.lines.read(self._load_pos_self_data_fields(self.config_id.id), load=False),
            'pos.payment': self.payment_ids.read(self.payment_ids._load_pos_data_fields(self.config_id.id), load=False),
            'pos.payment.method': self.payment_ids.mapped('payment_method_id').read(self.env['pos.payment.method']._load_pos_data_fields(self.config_id.id), load=False),
            'product.attribute.custom.value': self.lines.custom_attribute_value_ids.read(self.lines.custom_attribute_value_ids._load_pos_data_fields(self.config_id.id), load=False),
        }

    def _send_notification(self, order_ids):
        grouped_orders = {}
        for order in order_ids:
            grouped_orders.setdefault(order.session_id.config_id, self.env['pos.order'])
            grouped_orders[order.session_id.config_id] |= order

        for config, orders in grouped_orders.items():
            config._notify("ORDER_STATE_CHANGED", {
                'order_ids': orders.ids,
                'from_self': self.env.context.get('from_self', False),
            })

    def action_pos_order_paid(self):
        res = super().action_pos_order_paid()
        if self.pos_reference and 'Self-Order' in self.pos_reference:
            self.config_id._notify(
                'SELF_ORDERS_PAID', {'orders': self.read(['id', 'state'])}
            )
        return res

    @api.model_create_multi
    def create(self, vals_list):
        new_pos_orders = super().create(vals_list)

        if self.env.context.get('from_self'):
            grouped_draft_orders = {}
            for order in new_pos_orders.filtered(lambda order: order.state == 'draft'):
                grouped_draft_orders.setdefault(order.session_id.config_id, self.env['pos.order'])
                grouped_draft_orders[order.session_id.config_id] |= order

            for config, orders in grouped_draft_orders.items():
                config._notify("NEW_DRAFT_SELF_ORDERS", {'order_ids': orders.ids})

        return new_pos_orders
