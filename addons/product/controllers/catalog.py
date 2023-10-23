# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.http import request, route, Controller
from odoo.tools import groupby


class ProductCatalogController(Controller):

    @route('/product/catalog/order_lines_info', auth='user', type='json')
    def product_catalog_get_order_lines_info(self, res_model, order_id, product_ids, **kwargs):
        """ Returns products information to be shown in the catalog.

        :param string res_model: The order model.
        :param int order_id: The order id.
        :param list product_ids: The products currently displayed in the product catalog, as a list
                                 of `product.product` ids.
        :rtype: dict
        :return: A dict with the following structure:
            {
                product.id: {
                    'productId': int
                    'quantity': float (optional)
                    'price': float
                    'readOnly': bool (optional)
                }
            }
        """
        order, line_field_name = request.env[res_model]._get_record_and_lines_field_name(order_id)
        line_model = order[line_field_name]._name

        order_line_info = {}
        for product, lines in groupby(
            order[line_field_name].filtered(lambda line: not line.display_type),
            lambda line: line.product_id
        ):
            if product.id not in product_ids:
                continue

            order_lines = request.env[line_model].browse(line.id for line in lines)
            order_line_info[product.id] = order_lines._get_catalog_info(**kwargs)
            product_ids.remove(product.id)

        default_data = request.env[line_model]._get_catalog_info(**kwargs)
        default_data['readOnly'] = order._is_readonly() if order else False

        products = request.env['product.product'].browse(product_ids) - order[line_field_name].product_id
        product_data = order._get_product_catalog_order_line_info(products, **kwargs)
        for product_id, data in product_data.items():
            order_line_info[product_id] = {**default_data, **data}

        return order_line_info

    @route('/product/catalog/update_order_line_info', auth='user', type='json')
    def product_catalog_update_order_line_info(self, res_model, order_id, product_id, **kwargs):
        """ Update order line information on a given order for a given product.

        :param string res_model: The order model.
        :param int order_id: The order id.
        :param int product_id: The product, as a `product.product` id.
        :return: The unit price price of the product, based on the pricelist of the order and
                 the quantity selected.
        :rtype: float
        """
        order = request.env[res_model].browse(order_id)
        return order._update_order_line_info(product_id, **kwargs)
