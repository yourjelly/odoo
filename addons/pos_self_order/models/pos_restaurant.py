# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from typing import Dict, Callable, List, Optional

from odoo import api, fields, models


class RestaurantFloor(models.Model):
    _inherit = "restaurant.floor"

    def _get_data_for_qr_codes_page(self, url: Callable):
        return [
            {
                "name": floor.name,
                "tables": floor.table_ids.filtered("active")._get_data_for_qr_codes_page(url),
            }
            for floor in self
        ]


class RestaurantTable(models.Model):
    _inherit = "restaurant.table"

    access_token = fields.Char("Security Token", copy=False, readonly=True)

    def _get_self_order_data(self) -> Dict:
        self.ensure_one()
        return {
            "id": self.id,
            "name": self.name,
            "access_token": self.access_token,
        }

    def _get_data_for_qr_codes_page(self, url: Callable[[Optional[int]], str]) -> List[Dict]:
        return [
            {
                "id": table.id,
                "name": table.name,
                "url": url(table.id),
            }
            for table in self
        ]
