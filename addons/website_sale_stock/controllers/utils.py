# Part of Odoo. See LICENSE file for full copyright and licensing details.


def _get_stock_data(product_or_template, website, **kwargs):
    """ Return data about the provided product's stock.

    :param product.product|product.template product_or_template: The product for which to get data.
    :param website website: The website from which the request was made.
    :param dict kwargs: Locally unused data passed to `_get_product_available_qty`.
    :rtype: dict
    :return: A dict with the following structure:
        {
            'available_threshold': float,
            'free_qty': float,
            'qty': float,
            'show_availability': boolean,
            'uom_name': string
        }
    """
    stock_data = {
        'available_threshold': product_or_template.available_threshold,
        'qty': product_or_template.free_qty,
        'show_availability': product_or_template.show_availability,
        'uom_name': product_or_template.uom_id.name
    }

    if not product_or_template.allow_out_of_stock_order:
        available_qty = website._get_product_available_qty(
            product_or_template.sudo(), **kwargs
        ) if product_or_template.is_product_variant else 0
        cart_quantity = product_or_template._get_cart_qty(website)
        stock_data['free_qty'] = available_qty - cart_quantity

    return stock_data
