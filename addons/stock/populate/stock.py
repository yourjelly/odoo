import logging
from datetime import datetime, timedelta

from odoo import models
from odoo.tools import populate

_logger = logging.getLogger(__name__)


class ProductProduct(models.Model):
    _inherit = "product.product"

    def _populate_factories(self):
        res = super()._populate_factories()
        res.append(("type", populate.randomize(["consu", "service", "product"], [0.3, 0.2, 0.5])))
        return res


class Waherouse(models.Model):
    _inherit = "stock.warehouse"

    _populate_sizes = {
        "small": 0,  # Equals to mono-waherouse for each company
        "medium": 80,  # Medium = 20 companies -> average of 5 warehouse by companies
        "large": 950,  # Large = 50 companies -> average of 20 warehouse by companies
    }
    _populate_dependencies = ["res.company"]

    def _populate_factories(self):
        company_ids = self.env.registry.populated_models["res.company"]

        def get_company_id(random, **kwargs):
            return random.choice(company_ids)

        return [
            ('company_id', populate.compute(get_company_id)),
            ('name', populate.constant("Pop-WH-{counter}")),
            ('code', populate.constant("W{counter}")),
            ('reception_steps', populate.randomize(['one_step', 'two_steps', 'three_steps'], [0.6, 0.2, 0.2])),
            ('delivery_steps', populate.randomize(['ship_only', 'pick_ship', 'pick_pack_ship'], [0.6, 0.2, 0.2])),
        ]


class Location(models.Model):
    _inherit = "stock.location"
    _populate_sizes = {
        "small": 0,  # Equals to default location
        "medium": 1000,
        "large": 10000,
    }
    _populate_dependencies = ["stock.warehouse"]

    def _populate(self, size):
        res = super()._populate(size)
        # TODO : child-parent location
        return res

    def _populate_factories(self):
        return [
            ('name', populate.constant("Pop-Loc-{counter}")),
            # TODO : usage
        ]


class PickingType(models.Model):
    _inherit = "stock.picking.type"

    _populate_sizes = {
        "small": 0,  # Use only existing type
        "medium": 100,  # add 5 by companies in average
        "large": 2500,  # Add 50 by companies in average
    }
    _populate_dependencies = ["stock.location"]

    def _populate_factories(self):
        company_ids = self.env.registry.populated_models["res.company"]

        def get_company_id(random, **kwargs):
            return random.choice(company_ids)

        def false_repeat(**kwargs):
            return False

        return [
            ("name", populate.constant("PType-{counter}")),
            ("company_id", populate.compute(get_company_id)),
            ("sequence_code", populate.constant("PT{counter}-")),
            ("code", populate.randomize(['incoming', 'outgoing', 'internal'], [0.3, 0.3, 0.4])),
            ("warehouse_id", populate.compute(false_repeat)),
        ]


class Picking(models.Model):
    _inherit = "stock.picking"
    _populate_sizes = {"small": 500, "medium": 5000, "large": 50000}
    _populate_dependencies = ["stock.location", "stock.picking.type", "res.partner"]

    def _populate_factories(self):

        now = datetime.now()

        def get_until_date(random=None, **kwargs):
            # Maybe a other random distribution (betavariate ?)
            delta = random.randint(-50, 100)
            return now + timedelta(days=delta)

        def compute_type_information(iterator, field_name, model_name):
            picking_types = self.env['stock.picking.type'].search([])
            locations_internal = self.env['stock.location'].search([('usage', '=', 'internal')])
            locations_out = self.env['stock.location'].search([('usage', '=', 'customer')])
            locations_in = self.env['stock.location'].search([('usage', '=', 'supplier')])
            random = populate.Random("compute_type_information")
            for counter, values in enumerate(iterator):
                picking_type = random.choice(picking_types)
                values['picking_type_id'] = picking_type.id

                source_loc = picking_type.default_location_src_id
                dest_loc = picking_type.default_location_dest_id

                if not source_loc or random.random() > 0.8:
                    if picking_type.code == "incoming":
                        source_loc = random.choice(locations_out)
                    elif picking_type.code == "outgoing":
                        source_loc = random.choice(locations_in)
                    elif picking_type.code == "internal":
                        source_loc = random.choice(locations_internal)
                    else:
                        pass

                if not dest_loc or random.random() > 0.8:
                    if picking_type.code == "incoming":
                        dest_loc = random.choice(locations_in)
                    elif picking_type.code == "outgoing":
                        dest_loc = random.choice(locations_out)
                    elif picking_type.code == "internal":
                        dest_loc = random.choice(locations_internal)
                    else:
                        pass

                values['location_id'] = source_loc.id
                values['location_dest_id'] = dest_loc.id
                yield values

        return [
            ("priority", populate.randomize(['1', '0'], [0.1, 0.9])),
            ("scheduled_date", populate.compute(get_until_date)),
            ("compute_type_information", compute_type_information),
        ]


class StockMove(models.Model):
    _inherit = "stock.move"
    _populate_sizes = {"small": 2_000, "medium": 20_000, "large": 200_000}
    _populate_dependencies = ["stock.picking"]

    def _populate(self, size):
        res = super()._populate(size)
        # TODO : valid pickings of all move
        _logger.info("Stock move populate finish")
        return res

    def _populate_factories(self):

        # product_ids = self.env.registry.populated_models["product.product"].filtered(lambda p: p.type in ('product', 'consu'))
        # picking_idspicking_ids = self.env.registry.populated_models["stock.picking"]

        picking_ids = self.env["stock.picking"].search([('state', '=', 'draft')])

        def next_picking_generator():
            while picking_ids:
                yield from picking_ids

        def compute_move_information(iterator, field_name, model_name):
            product_ids = self.env["product.product"].search([('type', 'in', ('product', 'consu'))])
            next_picking = next_picking_generator()
            random = populate.Random("compute_move_information")
            for counter, values in enumerate(iterator):
                product = random.choice(product_ids)
                values["product_id"] = product.id
                values["product_uom"] = product.uom_id.id

                picking = next(next_picking)
                values["picking_id"] = picking.id
                values["location_id"] = picking.location_id.id
                values["location_dest_id"] = picking.location_dest_id.id
                values["name"] = picking.name
                yield values

        return [
            ("product_uom_qty", populate.randomize([i for i in range(1, 10)], [1 for _ in range(1, 10)])),
            ("compute_move_information", compute_move_information)
        ]
