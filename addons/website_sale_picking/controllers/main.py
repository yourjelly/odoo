# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _
from odoo.http import request, route
from odoo.exceptions import ValidationError

from odoo.addons.website_sale.controllers.main import WebsiteSale as WebsiteSaleController
from odoo.addons.website_sale.controllers.delivery import Delivery as DeliveryController
from odoo.addons.website_sale.controllers.payment import PaymentPortal


class WebsiteSaleOnsite(WebsiteSaleController):
    def _prepare_product_values(self, product, category, search, **kwargs):
        res = super()._prepare_product_values(product, category, search, **kwargs)
        sale_order = request.website.sale_get_order()
        if sale_order.carrier_id.delivery_type == 'onsite':
            res['selected_wh_location'] = sale_order.pickup_location_data
            res['zip_code'] = sale_order.partner_shipping_id.zip or '3000'
        return res


class OnsiteDelivery(DeliveryController):
    @route('/shop/product/store_locations', type='json', auth='public', website=True)
    def shop_store_locations(self, product_id):
        order_sudo = request.website.sale_get_order(force_create=True)
        if not order_sudo.carrier_id or order_sudo.carrier_id.delivery_type != 'onsite':
            # find and set click and collect delivery method
            onsite_dm = request.website.sudo().available_onsite_dm_id
            if not onsite_dm:
                return {'error': _("Click and Collect is not available.")}
            order_sudo.set_delivery_line(onsite_dm, onsite_dm.rate_shipment(order_sudo)['price'])
        product = request.env['product.product'].sudo().browse(product_id)
        store_locations = []
        for wh in order_sudo.carrier_id.warehouse_ids:
            free_qty = product.with_context(warehouse_id=wh.id).free_qty
            store_locations.append(
                request.env['delivery.carrier'].format_warehouse_location(
                    wh,
                    additional_data={
                        'in_stock': (free_qty > 0),
                        'show_quantity': (
                            product.show_availability and product.available_threshold >= free_qty
                        ),
                        'quantity': free_qty,
                    },
                )
            )
        if not store_locations:
            return {'error': _("No pick-up points are available for Click and Collect.")}
        return {'pickup_locations': store_locations}

    @route('/shop/set_click_and_collect', type='json', auth='public', website=True)
    def shop_set_click_and_collect(self, pickup_location_data):
        onsite_dm = request.website.sudo().available_onsite_dm_id
        if not onsite_dm:
            return {'error': _("Click and Collect is not available.")}
        order_sudo = request.website.sale_get_order()
        if order_sudo.carrier_id.delivery_type != 'onsite':
            order_sudo.set_delivery_line(onsite_dm, onsite_dm.product_id.list_price)
        order_sudo._set_pickup_location(pickup_location_data)


class PaymentPortalOnsite(PaymentPortal):

    def _validate_transaction_for_order(self, transaction, sale_order):
        """ Override of `website_sale `to make sure the onsite provider is not used without
        the onsite carrier.
        Also sets the sale order's warehouse id to the carrier's if it exists

        :raises ValidationError: if the user tries to pay on site without the matching delivery carrier
        """
        super()._validate_transaction_for_order(transaction, sale_order)

        # This should never be triggered unless the user intentionally forges a request.
        provider = transaction.provider_id
        if (
            sale_order.carrier_id.delivery_type != 'onsite'
            and provider.code == 'custom'
            and provider.custom_mode == 'onsite'
        ):
            raise ValidationError(_("You cannot pay onsite if the delivery is not onsite"))
        if sale_order.carrier_id.delivery_type == 'onsite':
            selected_wh_id = sale_order.pickup_location_data['warehouse_id']
            if not sale_order._is_cart_in_stock(selected_wh_id):
                raise ValidationError(
                    _("You can not pay as some products are not available in the selected store")
                )
            sale_order.warehouse_id = sale_order.env['stock.warehouse'].browse(selected_wh_id)
