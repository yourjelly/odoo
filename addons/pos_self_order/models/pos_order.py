# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import re
from typing import Dict, Union

from odoo import models


class PosOrderLine(models.Model):
    _inherit = "pos.order.line"

    def _export_for_ui(self, orderline):
        return {
            'uuid': orderline.uuid,
            'note': orderline.note,
            **super()._export_for_ui(orderline),
        }


class PosOrder(models.Model):
    _inherit = "pos.order"

    def _export_for_self_order(self) -> Dict:
        self.ensure_one()
        self.ensure_one()
        return {
            "id": self.id,
            "pos_config_id": self.config_id.id,
            "pos_reference": self.pos_reference,
            "access_token": self.access_token,
            "state": self.state,
            "date": str(self.date_order),
            "amount_total": self.amount_total,
            "amount_tax": self.amount_tax,
            "lines": [
                {
                    "id": line.id,
                    "price_subtotal": line.price_subtotal,
                    "price_subtotal_incl": line.price_subtotal_incl,
                    "product_id": line.product_id.id,
                    "uuid": line.uuid,
                    "qty": line.qty,
                    "customer_note": line.customer_note,
                    "full_product_name": line.full_product_name,
                }
                for line in self.lines
            ],
        }

    def _get_self_order_data(self) -> Dict[str, Union[str, int]]:
        return {
            'id': self.pos_reference,
            'sequence_number': self.sequence_number,
            'access_token': self.access_token,
            'session_id': self.session_id.id,
            'table_id': self.table_id.id,
        }
