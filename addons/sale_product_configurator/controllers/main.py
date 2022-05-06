# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.http import request, route
from odoo.addons.sale.controllers.variant import VariantController


class ProductConfiguratorController(VariantController):

    @route(['/sale_product_configurator/configure'], type='json', auth="user", methods=['POST'])
    def configure(self, product_template_id, pricelist_id, add_qty=1, **kw):
        product_template = request.env['product.template'].browse(int(product_template_id))

        attribute_value_ids = set(kw.get('product_template_attribute_value_ids', []))
        attribute_value_ids |= set(kw.get('product_no_variant_attribute_value_ids', []))
        product_combination = request.env['product.template.attribute.value'].browse(attribute_value_ids)

        return request.env['ir.ui.view']._render_template("sale_product_configurator.configure", {
            'product': product_template,
            'pricelist': self._get_pricelist(pricelist_id),
            'add_qty': int(add_qty),
            'product_combination': product_combination
        })

    @route(['/sale_product_configurator/show_advanced_configurator'], type='json', auth="user", methods=['POST'])
    def show_advanced_configurator(self, product_id, variant_values, pricelist_id, handle_stock=False, add_qty=1, **kw):
        product = request.env['product.product'].browse(int(product_id))
        combination = request.env['product.template.attribute.value'].browse(variant_values)

        no_variant_attribute_values = combination.filtered(
            lambda ptav: ptav.attribute_id.create_variant == 'no_variant'
        )
        if no_variant_attribute_values:
            product = product.with_context(no_variant_attribute_values=no_variant_attribute_values)

        return request.env['ir.ui.view']._render_template(
            "sale_product_configurator.optional_products_modal",
            {
                'product': product,
                'combination': combination,
                'add_qty': int(add_qty),
                'parent_name': product.name,
                'variant_values': variant_values,
                'pricelist': self._get_pricelist(pricelist_id),
                'handle_stock': handle_stock,
                'already_configured': kw.get("already_configured", False)
            }
        )

    @route(['/sale_product_configurator/optional_product_items'], type='json', auth="user", methods=['POST'])
    def optional_product_items(self, product_id, pricelist_id, add_qty=1, **kw):
        add_qty = int(add_qty)
        product = request.env['product.product'].browse(int(product_id))

        parent_combination = product.product_template_attribute_value_ids
        if product.env.context.get('no_variant_attribute_values'):
            # FIXME VFE do we ever give this context ?
            # Add "no_variant" attribute values' exclusions
            # They are kept in the context since they are not linked to this product variant
            parent_combination |= product.env.context.get('no_variant_attribute_values')

        return request.env['ir.ui.view']._render_template(
            "sale_product_configurator.optional_product_items",
            {
                'product': product,
                'parent_name': product.name,
                'parent_combination': parent_combination,
                'pricelist': self._get_pricelist(pricelist_id),
                'add_qty': add_qty,
            }
        )
