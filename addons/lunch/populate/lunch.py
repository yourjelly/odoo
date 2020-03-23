# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging

from odoo import models
from odoo.tools import populate

_logger = logging.getLogger(__name__)


class LunchProductCategory(models.Model):
    _inherit = "lunch.product.category"
    _populate_sizes = {"small": 10, "medium": 50, "large": 100}

    def _populate_factories(self):
        def name_callable(values=None, counter=0, complete=False, **kwargs):
            return "%s_%s_%s" % ("lunch_product_category", int(complete), counter)

        return [("name", populate.compute(name_callable))]


class LunchProduct(models.Model):
    _inherit = "lunch.product"
    _populate_sizes = {"small": 10, "medium": 2000, "large": 10000}
    _populate_dependencies = ["lunch.product.category", "res.partner"]

    def _populate_factories(self):

        prices = [float(p) for p in range(100)]
        category_ids = self.env.registry.populated_models["lunch.product.category"]
        supplier_ids = self.env.registry.populated_models["res.partner"]

        return [
            ("name", populate.get_string("lunch_product")),
            ("category_id", populate.randomize(category_ids)),
            ("price", populate.randomize([False] + prices)),
            ("supplier", populate.randomize([False] + supplier_ids)),
            ("active", populate.cartesian([True, False], [0.9, 0.1])),
        ]


class LunchOrder(models.Model):
    _inherit = "lunch.order"
    _populate_sizes = {"small": 20, "medium": 3000, "large": 15000}
    _populate_dependencies = ["lunch.product", "res.users"]

    def _populate_factories(self):

        user_ids = self.env.registry.populated_models["res.users"]
        product_ids = self.env.registry.populated_models["lunch.product"]

        order_line_generator = [
            ("product_id", populate.randomize(product_ids)),
            ("state", populate.randomize(['new', 'confirmed', 'ordered', 'cancelled'], weights=[0.5, 0.7, 0.4, 0.1]))
            ]

        order_lines_values_generator = populate.chain_factories(
            order_line_generator, "lunch.order.line"
        )

        def get_order_line_ids(values=None, counter=0, complete=False, random=None, **kwargs):
            nb_lines = random.randint(0, 20)
            lines_values = []
            for val in order_lines_values_generator:
                nb_lines -= 1
                if nb_lines < 0:
                    break
                lines_values.append((0, 0, {k: v for k, v in val.items() if k != '__complete'}))
            return lines_values

        return [
            ("user_id", populate.randomize(user_ids)),
            ("order_line_ids", populate.compute(get_order_line_ids)),
        ]

    def _populate(self, scale):
        new_lunch_orders = super(LunchOrder, self)._populate(scale)
        # confirm order lines in order to generate lunch.cashmove
        order_line_ids = [l.id for order in new_lunch_orders for l in order.order_line_ids if l.state != 'confirmed']
        self.env['lunch.order.line'].browse(order_line_ids).confirm()
        return new_lunch_orders


class LunchAlert(models.Model):
    _inherit = "lunch.alert"
    _populate_sizes = {"small": 10, "medium": 40, "large": 150}
    _populate_dependencies = ["res.partner"]

    def _populate_factories(self):

        partner_ids = self.env.registry.populated_models["res.partner"]

        def get_alert_message(values=None, counter=0, complete=False, **kwargs):
            return "%s_%s_%s" % ("lunch_alert", int(complete), counter)

        def get_start_hour(values=None, counter=0, complete=False, random=None, **kwargs):
            return random.randint(0, 24)

        def get_end_hour(values=None, counter=0, complete=False, random=None, **kwargs):
            start = values.get("start_hour", 0)
            return random.randint(start, 24)

        return [
            ("message", populate.compute(get_alert_message)),
            ("alert_type", populate.randomize(["specific", "week", "days"])),
            ("partner_id", populate.randomize(partner_ids)),
            ("monday", populate.randomize([True, False])),
            ("tuesday", populate.randomize([True, False])),
            ("wednesday", populate.randomize([True, False])),
            ("thursday", populate.randomize([True, False])),
            ("friday", populate.randomize([True, False])),
            ("saturday", populate.randomize([True, False])),
            ("sunday", populate.randomize([True, False])),
            ("start_hour", populate.compute(get_start_hour)),
            ("end_hour", populate.compute(get_end_hour)),
            ("active", populate.randomize([True, False])),
        ]
