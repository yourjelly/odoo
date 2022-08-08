from odoo import models, api
from functools import reduce


class PosOrder(models.Model):
    """
    adding methods to handle the blocking functionality properly
    """
    _inherit = "pos.order"

    def _enough_quants_in_stock(self, line, location, location_product_map: dict):
        """
        intended to be used after _hash_by_location_product
        dicts are passed by reference, no need to return the altered location_product_map
        :param list<dict> line          :
        :param int location             : a location id
        :param dict location_product_map: a hash map
        :return bool                    : True if the quantity found in the dict is more than 0 and product_type is
        'product'
        """
        line = line[-1]

        if not location_product_map.get(location):
            # case: the only product is a service
            return True

        if line.get("product_id") not in location_product_map[location]:
            # ignoring non-storable products
            return True
        quant = location_product_map[location][line["product_id"]]
        quant["quantity"] -= line["qty"]
        return quant["quantity"] >= 0

    def _hash_by_location_product(self, results: list):
        """
        intended to be used after search_read
        :param list results:
        :return dict<Number, dict<Number, Number>>: hash table that maps between locations and hash tables that
                                                    map between products and their onhand quantity
        """
        output = {}
        for result in results:
            location = result["location_id"][0]
            product = result["product_id"][0]
            if location not in output:
                output[location] = {}
            output[location][product] = {"quantity": result['available_quantity']}
        return output

    @api.model
    def create_from_ui(self, orders, draft=False):
        """
        Adding another layer of validation to account for users that go offline for too long and locations that are used
        in many PoS sessions concurrently
        :param list<dict> orders:
        :param bool draft       :
        """
        config_id = self.env["pos.session"].browse(orders[0]["data"]["pos_session_id"]).config_id
        # exit early if the blocking feature is not active on this pos config
        if not config_id.block_when_no_stock:
            return super(PosOrder, self).create_from_ui(orders, draft)

        to_create = []
        to_revalidate = []
        location_id = config_id.location_id

        # grabbing product ids from the orders
        products = reduce(lambda res, o: [*res, *map(lambda l: l[2]["product_id"], o["data"]["lines"])], orders, [])

        # getting only products that are of type 'product' (storable)
        # only those will be checked
        products_to_use = self.env["product.product"].search_read([("id", "in", products), ("type", "=", "product")],
                                                                  ["id"])
        products_to_use = [*map(lambda p: p["id"], products_to_use)]

        # all quants in this location for storable products
        results = self.env["stock.quant"].search_read(
            [("location_id", "=", location_id), ("product_id", "in", products_to_use)],
            fields=["location_id", "product_id", "available_quantity"])

        location_product_map = self._hash_by_location_product(results)

        for order in orders:
            revalidate_flag = False
            lines = order["data"]["lines"]
            for line in lines:
                if not self._enough_quants_in_stock(line, location_id, location_product_map):
                    revalidate_flag = True
                    to_revalidate.append(order)
                    break
            if not revalidate_flag:
                to_create.append(order)

        created = super(PosOrder, self).create_from_ui(to_create, draft)
        if len(to_revalidate):
            return [False, to_revalidate]
        return created
