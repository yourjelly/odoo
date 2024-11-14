# Part of Odoo. See LICENSE file for full copyright and licensing details.

from werkzeug.exceptions import NotFound

from odoo import fields
from odoo.http import Controller, request, route

from odoo.addons.payment import utils as payment_utils
from odoo.addons.sale.controllers import portal as sale_portal


class Cart(Controller):

    @route(['/shop/cart'], type='http', auth="public", website=True, sitemap=False)
    def cart(self, access_token=None, revive='', **post):
        """
        Main cart management + abandoned cart revival
        access_token: Abandoned cart SO access token
        revive: Revival method when abandoned cart. Can be 'merge' or 'squash'
        """
        if not request.website.has_ecommerce_access():
            return request.redirect('/web/login')

        order = request.website.sale_get_order()
        if order and order.state != 'draft':
            request.session['sale_order_id'] = None
            order = request.website.sale_get_order()

        request.session['website_sale_cart_quantity'] = order.cart_quantity

        values = {}
        if access_token:
            abandoned_order = request.env['sale.order'].sudo().search([('access_token', '=', access_token)], limit=1)
            if not abandoned_order:  # wrong token (or SO has been deleted)
                raise NotFound()
            if abandoned_order.state != 'draft':  # abandoned cart already finished
                values.update({'abandoned_proceed': True})
            elif revive == 'squash' or (revive == 'merge' and not request.session.get('sale_order_id')):  # restore old cart or merge with unexistant
                request.session['sale_order_id'] = abandoned_order.id
                return request.redirect('/shop/cart')
            elif revive == 'merge':
                abandoned_order.order_line.write({'order_id': request.session['sale_order_id']})
                abandoned_order.action_cancel()
            elif abandoned_order.id != request.session.get('sale_order_id'):  # abandoned cart found, user have to choose what to do
                values.update({'access_token': abandoned_order.access_token})

        values.update({
            'website_sale_order': order,
            'date': fields.Date.today(),
            'suggested_products': [],
        })
        if order:
            order.order_line.filtered(lambda sol: sol.product_id and not sol.product_id.active).unlink()
            values['suggested_products'] = order._cart_accessories()
            values.update(self._get_express_shop_payment_values(order))

        values.update(self._cart_values(**post))
        return request.render("website_sale.cart", values)

    def _get_express_shop_payment_values(self, order, **kwargs):
        payment_form_values = sale_portal.CustomerPortal._get_payment_values(
            self, order, website_id=request.website.id, is_express_checkout=True
        )
        payment_form_values.update({
            'payment_access_token': payment_form_values.pop('access_token'),  # Rename the key.
            'minor_amount': payment_utils.to_minor_currency_units(
                order.amount_total, order.currency_id
            ),
            'merchant_name': request.website.name,
            'transaction_route': f'/shop/payment/transaction/{order.id}',
            'express_checkout_route': self._express_checkout_route,
            'landing_route': '/shop/payment/validate',
            'payment_method_unknown_id': request.env.ref('payment.payment_method_unknown').id,
            'shipping_info_required': order._has_deliverable_products(),
            'delivery_amount': payment_utils.to_minor_currency_units(
                order.order_line.filtered(lambda l: l.is_delivery).price_total, order.currency_id
            ),
            'shipping_address_update_route': self._express_checkout_delivery_route,
        })
        if request.website.is_public_user():
            payment_form_values['partner_id'] = -1
        return payment_form_values

    def _cart_values(self, **post):
        """
        This method is a hook to pass additional values when rendering the 'website_sale.cart' template (e.g. add
        a flag to trigger a style variation)
        """
        return {}

    @route(
        '/shop/cart/update',
        type='jsonrpc',
        auth="public",
        methods=['POST'],
        website=True,
        sitemap=False
    )
    def update_cart(
        self,
        line_id,
        product_id,
        quantity,
    ):
        order_sudo = request.website.sale_get_order()

        values = order_sudo._cart_update(
            product_id=product_id,
            line_id=line_id,
            set_qty=quantity,
        )

        request.session['website_sale_cart_quantity'] = order_sudo.cart_quantity
        if not order_sudo.cart_quantity:
             request.website.sale_reset()
             return values

        values['cart_quantity'] = order_sudo.cart_quantity
        values['cart_ready'] = order_sudo._is_cart_ready()
        values['amount'] = order_sudo.amount_total
        values['minor_amount'] = payment_utils.to_minor_currency_units(
            order_sudo.amount_total, order_sudo.currency_id
        )
        values['website_sale.cart_lines'] = request.env['ir.ui.view']._render_template(
            "website_sale.cart_lines", {
                'website_sale_order': order_sudo,
                'date': fields.Date.today(),
                'suggested_products': order_sudo._cart_accessories()
            }
        )
        values['website_sale.total'] = request.env['ir.ui.view']._render_template(
            "website_sale.total", {
                'website_sale_order': order_sudo,
            }
        )
        return values

    @route(
        '/shop/cart/add',
        type='jsonrpc',
        auth="public",
        methods=['POST'],
        website=True,
        sitemap=False
    )
    def add_to_cart(
        self,
        product_template_id,
        product_id=None,
        # TODO VCR Add Combination
        line_id=None,
        quantity=None,
        product_custom_attribute_values=None,
        no_variant_attribute_value_ids=None,
        optional_products=None,
        **kwargs
    ):
        """_summary_

        TODO VCR docstring

         This route is called :
            - When changing quantity from the cart.
            - When adding a product from the wishlist.
            - When adding a product to cart on the same page (without redirection).

        :param int product_id: The product, as a `product.product` id.
        :param line_id: The sale order line, as a `sale.order.line` id.
        :param quantity: _description_, defaults to None
        :param set_qty: _description_, defaults to None
        :param bool display: Whether the cart is display or not.
        :param product_custom_attribute_values: _description_, defaults to None
        :param no_variant_attribute_value_ids: _description_, defaults to None
        :return: _description_
        :rtype: _type_
        """
        order_sudo = request.website.sale_get_order(force_create=True)
        if order_sudo.state != 'draft':
            request.session['sale_order_id'] = None
            if kwargs.get('force_create'):
                order_sudo = request.website.sale_get_order(force_create=True)
            else:
                return {}

        # TODO VCR

        values = order_sudo._cart_update(
            product_id=product_id,
            line_id=line_id,
            add_qty=quantity,
            product_custom_attribute_values=product_custom_attribute_values,
            no_variant_attribute_value_ids=no_variant_attribute_value_ids,
            **kwargs
        )
        line_ids = {product_template_id: values['line_id']}

        if optional_products and values['line_id']:
            for option in optional_products:
                option_values = order_sudo._cart_update(
                    product_id=option['product_id'],
                    add_qty=option['quantity'],
                    product_custom_attribute_values=option['product_custom_attribute_values'],
                    no_variant_attribute_value_ids=[
                        int(value_id) for value_id in option['no_variant_attribute_value_ids']
                    ],
                    # Using `line_ids[...]` instead of `line_ids.get(...)` ensures that this throws
                    # if an optional product contains bad data.
                    linked_line_id=line_ids[option['parent_product_template_id']],
                    **kwargs,
                )
                line_ids[option['product_template_id']] = option_values['line_id']

        # If the line is a combo product line, and it already has combo items, we need to update
        # the combo item quantities as well.
        line = request.env['sale.order.line'].browse(values['line_id'])
        if line.product_type == 'combo' and line.linked_line_ids:
            for linked_line_id in line.linked_line_ids:
                if values['quantity'] != linked_line_id.product_uom_qty:
                    order_sudo._cart_update(
                        product_id=linked_line_id.product_id.id,
                        line_id=linked_line_id.id,
                        set_qty=values['quantity'],
                    )

        values['notification_info'] = self._get_cart_notification_information(order_sudo, line_ids.values())
        values['notification_info']['warning'] = values.pop('warning', '')
        request.session['website_sale_cart_quantity'] = order_sudo.cart_quantity

        if not order_sudo.cart_quantity:
            request.website.sale_reset()
            return values

        values['cart_quantity'] = order_sudo.cart_quantity

        return values

    @route(['/shop/cart/quantity'], type='jsonrpc', auth="public", methods=['POST'], website=True)
    def cart_quantity(self):
        if 'website_sale_cart_quantity' not in request.session:
            return request.website.sale_get_order().cart_quantity
        return request.session['website_sale_cart_quantity']

    @route(['/shop/cart/clear'], type='jsonrpc', auth="public", website=True)
    def clear_cart(self):
        order = request.website.sale_get_order()
        for line in order.order_line:
            line.unlink()

    def _get_cart_notification_information(self, order, line_ids):
        """ Get the information about the sale order lines to show in the notification.

        :param recordset order: The sale order containing the lines.
        :param list(int) line_ids: The ids of the lines to display in the notification.
        :rtype: dict
        :return: A dict with the following structure:
            {
                'currency_id': int
                'lines': [{
                    'id': int
                    'image_url': int
                    'quantity': float
                    'name': str
                    'description': str
                    'line_price_total': float
                }],
            }
        """
        lines = order.order_line.filtered(lambda line: line.id in line_ids)
        if not lines:
            return {}

        show_tax = order.website_id.show_line_subtotals_tax_selection == 'tax_included'
        return {
            'currency_id': order.currency_id.id,
            'lines': [
                { # For the cart_notification
                    'id': line.id,
                    'image_url': order.website_id.image_url(line.product_id, 'image_128'),
                    'quantity': line._get_displayed_quantity(),
                    'name': line.name_short,
                    'description': line._get_sale_order_line_multiline_description_variants(),
                    'line_price_total': line.price_total if show_tax else line.price_subtotal,
                    **self._get_additional_cart_notification_information(line),
                } for line in lines
            ],
        }

    def _get_additional_cart_notification_information(self, line):
        # Only set the linked line id for combo items, not for optional products.
        if line.combo_item_id:
            return {'linked_line_id': line.linked_line_id.id}
        return {}
