# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ProductTemplate(models.Model):
    _inherit = 'product.template'
    _check_company_auto = True

    optional_product_ids = fields.Many2many(
        comodel_name='product.template',
        relation='product_optional_rel',
        column1='src_id',
        column2='dest_id',
        string="Optional Products",
        help="Optional Products are suggested "
             "whenever the customer hits *Add to Cart* (cross-sell strategy, "
             "e.g. for computers: warranty, software, etc.).",
        check_company=True)

    
    @api.depends('attribute_line_ids.value_ids.is_custom', 'attribute_line_ids.attribute_id.create_variant')
    def _compute_has_configurable_attributes(self):
        """ A product is considered configurable if:
        - It has dynamic attributes
        - It has any attribute line with at least 2 attribute values configured
        - It has at least one custom attribute value """
        for product in self:
            product.has_configurable_attributes = (
                any(attribute.create_variant == 'dynamic' for attribute in product.attribute_line_ids.attribute_id)
                or any(len(attribute_line_id.value_ids) >= 2 for attribute_line_id in product.attribute_line_ids)
                or any(attribute_value.is_custom for attribute_value in product.attribute_line_ids.value_ids)
            )

    # def get_single_purchase_product_variant(self):
    #     """ Method used by the product configurator to check if the product is configurable or not.

    #     We need to open the product configurator if the product:
    #     - is configurable (see has_configurable_attributes)
    #     - has optional products """
    #     res = super().get_single_product_variant()
    #     if res.get('product_id', False):
    #         has_optional_products = False
    #         for optional_product in self.product_variant_id.optional_product_ids:
    #             if optional_product.has_dynamic_attributes() or optional_product._get_possible_variants(
    #                 self.product_variant_id.product_template_attribute_value_ids
    #             ):
    #                 has_optional_products = True
    #                 break
    #         res.update({'has_optional_products': has_optional_products})
    #     print(res)
    #     return res
    
    # def _get_product_price(self, product, *args, **kwargs):
    #     """Compute the pricelist price for the specified product, qty & uom.

    #     Note: self and self.ensure_one()

    #     :param product: product record (product.product/product.template)
    #     :param float quantity: quantity of products requested (in given uom)
    #     :param currency: record of currency (res.currency) (optional)
    #     :param uom: unit of measure (uom.uom record) (optional)
    #         If not specified, prices returned are expressed in product uoms
    #     :param date: date to use for price computation and currency conversions (optional)
    #     :type date: date or datetime

    #     :returns: unit price of the product, considering pricelist rules if any
    #     :rtype: float
    #     """
    #     self and self.ensure_one()  # self is at most one record
    #     return self._compute_price_rule(product, *args, **kwargs)[product.id][0]
    
    # def _compute_price_rule(
    #         self, products, quantity, currency=None, uom=None, date=False, compute_price=True,
    #         **kwargs
    # ):
    #     """ Low-level method - Mono pricelist, multi products
    #     Returns: dict{product_id: (price, suitable_rule) for the given pricelist}

    #     Note: self and self.ensure_one()

    #     :param products: recordset of products (product.product/product.template)
    #     :param float quantity: quantity of products requested (in given uom)
    #     :param currency: record of currency (res.currency)
    #                      note: currency.ensure_one()
    #     :param uom: unit of measure (uom.uom record)
    #         If not specified, prices returned are expressed in product uoms
    #     :param date: date to use for price computation and currency conversions
    #     :type date: date or datetime
    #     :param bool compute_price: whether the price should be computed (default: True)

    #     :returns: product_id: (price, pricelist_rule)
    #     :rtype: dict
    #     """
    #     self and self.ensure_one()  # self is at most one record

    #     currency = currency or self.currency_id or self.env.company.currency_id
    #     currency.ensure_one()

    #     if not products:
    #         return {}

    #     if not date:
    #         # Used to fetch pricelist rules and currency rates
    #         date = fields.Datetime.now()

    #     # Fetch all rules potentially matching specified products/templates/categories and date
    #     rules = self._get_applicable_rules(products, date, **kwargs)

    #     results = {}
    #     for product in products:
    #         suitable_rule = self.env['product.pricelist.item']

    #         product_uom = product.uom_id
    #         target_uom = uom or product_uom  # If no uom is specified, fall back on the product uom

    #         # Compute quantity in product uom because pricelist rules are specified
    #         # w.r.t product default UoM (min_quantity, price_surchage, ...)
    #         if target_uom != product_uom:
    #             qty_in_product_uom = target_uom._compute_quantity(
    #                 quantity, product_uom, raise_if_failure=False
    #             )
    #         else:
    #             qty_in_product_uom = quantity

    #         for rule in rules:
    #             if rule._is_applicable_for(product, qty_in_product_uom):
    #                 suitable_rule = rule
    #                 break

    #         if compute_price:
    #             price = suitable_rule._compute_price(
    #                 product, quantity, target_uom, date=date, currency=currency)
    #             print(price)
    #         else:
    #             # Skip price computation when only the rule is requested.
    #             price = 0.0
    #         results[product.id] = (price, suitable_rule.id)

    #     return results
    
class ProductAttributeCustomValue(models.Model):
    _inherit = "product.attribute.custom.value"

    purchase_order_line_id = fields.Many2one('purchase.order.line', string="Purchase Order Line", required=True, ondelete='cascade')

    _sql_constraints = [
        ('pol_custom_value_unique', 'unique(custom_product_template_attribute_value_id, purchase_order_line_id)', "Only one Custom Value is allowed per Attribute Value per Purchase Order Line.")
    ]
