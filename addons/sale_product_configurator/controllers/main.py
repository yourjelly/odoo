# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime

from odoo.http import Controller, request, route


class ProductConfiguratorController(Controller):

    @route('/sale_product_configurator/get_values', type='json', auth='user')
    def get_product_configurator_values(
        self,
        product_template_id,
        quantity,
        currency_id,
        so_date,
        product_uom_id=None,
        company_id=None,
        pricelist_id=None,
        ptav_ids=None,
        only_main_product=False,
    ):
        """ Return all product information needed for the product configurator.

        :param int product_template_id: The product for which to seek information, as a
                                        `product.template` id.
        :param int quantity: The quantity of the product.
        :param int currency_id: The currency of the transaction, as a `res.currency` id.
        :param str so_date: The date of the `sale.order`, to compute the price at the right rate.
        :param int|None product_uom_id: The unit of measure of the product, as a `uom.uom` id.
        :param int|None company_id: The company to use, as a `res.company` id.
        :param int|None pricelist_id:  The pricelist to use, as a `product.pricelist` id.
        :param recordset|None product_template_attribute_value_ids: The combination of the product,
                                                                    as a `product.template.attribute
                                                                    .value` recordset.
        :param bool only_main_product: Whether the optional products should be included or not.
        :rtype: dict
        :return: A dict containing a list of products and a list of optional products information,
                 generated by :meth:`_get_product_information`.
        """
        print('--------------',pricelist_id)
        if company_id:
            request.update_context(allowed_company_ids=[company_id])
        product_template = request.env['product.template'].browse(product_template_id)

        if ptav_ids:
            combination = request.env['product.template.attribute.value'].browse(ptav_ids)
        else:
            combination = product_template._get_first_possible_combination()

        return dict(
            products=[
                self._get_product_information(
                    product_template,
                    combination,
                    currency_id,
                    so_date,
                    quantity=quantity,
                    product_uom_id=product_uom_id,
                    pricelist_id=pricelist_id,
                )
            ],
            optional_products=[
                dict(
                    **self._get_product_information(
                        optional_product_template,
                        optional_product_template._get_first_possible_combination(
                            parent_combination=combination
                        ),
                        currency_id,
                        so_date,
                        # giving all the ptav of the parent product to get all the exclusions
                        parent_combination=product_template.attribute_line_ids.\
                            product_template_value_ids,
                        pricelist_id=pricelist_id,
                    ),
                    parent_product_tmpl_ids=[product_template.id],
                ) for optional_product_template in product_template.optional_product_ids
            ] if not only_main_product else []
        )

    @route('/sale_product_configurator/create_product', type='json', auth='user')
    def sale_product_configurator_create_product(self, product_template_id, combination):
        """ Create the product when there is a dynamic attribute in the combination.

        :param int product_template_id: The product for which to seek information, as a
                                        `product.template` id.
        :param recordset combination: The combination of the product, as a
                                      `product.template.attribute.value` recordset.
        :rtype: int
        :return: The product created, as a `product.product` id.
        """
        product_template = request.env['product.template'].browse(product_template_id)
        combination = request.env['product.template.attribute.value'].browse(combination)
        product = product_template._create_product_variant(combination)
        return product.id

    @route('/sale_product_configurator/update_combination', type='json', auth='user')
    def sale_product_configurator_update_combination(
        self,
        product_template_id,
        combination,
        currency_id,
        so_date,
        quantity,
        product_uom_id=None,
        company_id=None,
        pricelist_id=None,
    ):
        """ Return the updated combination information.

        :param int product_template_id: The product for which to seek information, as a
                                        `product.template` id.
        :param recordset combination: The combination of the product, as a
                                      `product.template.attribute.value` recordset.
        :param int currency_id: The currency of the transaction, as a `res.currency` id.
        :param str so_date: The date of the `sale.order`, to compute the price at the right rate.
        :param int quantity: The quantity of the product.
        :param int|None product_uom_id: The unit of measure of the product, as a `uom.uom` id.
        :param int|None company_id: The company to use, as a `res.company` id.
        :param int|None pricelist_id:  The pricelist to use, as a `product.pricelist` id.
        :rtype: dict
        :return: Basic informations about a product, generated by
                 :meth:`_get_basic_product_information`.
        """
        if company_id:
            request.update_context(allowed_company_ids=[company_id])
        product_template = request.env['product.template'].browse(product_template_id)
        pricelist = request.env['product.pricelist'].browse(pricelist_id)
        product_uom = request.env['uom.uom'].browse(product_uom_id)
        currency = request.env['res.currency'].browse(currency_id)
        combination = request.env['product.template.attribute.value'].browse(combination)
        product = product_template._get_variant_for_combination(combination)

        return self._get_basic_product_information(
            product or product_template,
            pricelist,
            combination,
            quantity=quantity,
            uom=product_uom,
            currency=currency,
            date=datetime.fromisoformat(so_date),
        )

    @route('/sale_product_configurator/get_optional_products', type='json', auth='user')
    def sale_product_configurator_get_optional_products(
        self,
        product_template_id,
        combination,
        parent_combination,
        currency_id,
        so_date,
        company_id=None,
        pricelist_id=None,
    ):
        """ Return information about optional products for the given `product.template`.

        :param int product_template_id: The product for which to seek information, as a
                                        `product.template` id.
        :param recordset combination: The combination of the product, as a
                                      `product.template.attribute.value` recordset.
        :param recordset parent_combination: The combination of the parent product, as a
                                             `product.template.attribute.value` recordset.
        :param int currency_id: The currency of the transaction, as a `res.currency` id.
        :param str so_date: The date of the `sale.order`, to compute the price at the right rate.
        :param int|None company_id: The company to use, as a `res.company` id.
        :param int|None pricelist_id:  The pricelist to use, as a `product.pricelist` id.
        :rtype: [dict]
        :return: A list of optional products information, generated by
                 :meth:`_get_product_information`.
        """
        if company_id:
            request.update_context(allowed_company_ids=[company_id])
        product_template = request.env['product.template'].browse(product_template_id)
        parent_combination = request.env['product.template.attribute.value'].browse(
            parent_combination + combination
        )
        return [
            dict(
                **self._get_product_information(
                    optional_product_template,
                    optional_product_template._get_first_possible_combination(
                        parent_combination=parent_combination
                    ),
                    currency_id,
                    so_date,
                    parent_combination=parent_combination,
                    pricelist_id=pricelist_id,
                ),
                parent_product_tmpl_ids=[product_template.id],
            ) for optional_product_template in product_template.optional_product_ids
        ]

    def _get_product_information(
        self,
        product_template,
        combination,
        currency_id,
        so_date,
        quantity=1,
        product_uom_id=None,
        pricelist_id=None,
        parent_combination=None,
    ):
        """ Return complete information about a product.

        :param recordset product_template: The product for which to seek information, as a
                                           `product.template` record.
        :param recordset combination: The combination of the product, as a
                                      `product.template.attribute.value` recordset.
        :param int currency_id: The currency of the transaction, as a `res.currency` id.
        :param str so_date: The date of the `sale.order`, to compute the price at the right rate.
        :param int quantity: The quantity of the product.
        :param int|None product_uom_id: The unit of measure of the product, as a `uom.uom` id.
        :param int|None pricelist_id:  The pricelist to use, as a `product.pricelist` id.
        :param recordset|None parent_combination: The combination of the parent product, as a
                                                  `product.template.attribute.value` recordset.
        :rtype: dict
        :return: A dict with the following structure:
            {
                'product_tmpl_id': int,
                'id': int,
                'description_sale': str|False,
                'display_name': str,
                'price': float,
                'quantity': int
                'attribute_line': [{
                    'id': int
                    'attribute': {
                        'id': int
                        'name': str
                        'display_type': str
                    },
                    'attribute_value': [{
                        'id': int,
                        'name': str,
                        'price_extra': float,
                        'html_color': str|False,
                        'is_custom': bool
                    }],
                    'selected_attribute_id': int,
                }],
                'exclusions': dict,
                'archived_combination': dict,
                'parent_exclusions': dict,
            }
        """
        pricelist = request.env['product.pricelist'].browse(pricelist_id)
        product_uom = request.env['uom.uom'].browse(product_uom_id)
        currency = request.env['res.currency'].browse(currency_id)
        product = product_template._get_variant_for_combination(combination)
        attribute_exclusions = product_template._get_attribute_exclusions(
            parent_combination=parent_combination
        )

        return dict(
            product_tmpl_id=product_template.id,
            **self._get_basic_product_information(
                product or product_template,
                pricelist,
                combination,
                quantity=quantity,
                uom=product_uom,
                currency=currency,
                date=datetime.fromisoformat(so_date),
            ),
            quantity=quantity,
            attribute_lines=[dict(
                id=ptal.id,
                attribute=dict(**ptal.attribute_id.read(['id', 'name', 'display_type'])[0]),
                attribute_values=[dict(
                    **ptav.read(['name', 'html_color', 'is_custom'])[0],
                    price_extra=ptav.currency_id._convert(
                        ptav.price_extra,
                        currency,
                        request.env.company,
                        datetime.fromisoformat(so_date).date(),
                    ),
                ) for ptav in ptal.product_template_value_ids],
                selected_attribute_value_id=combination.filtered(
                    lambda c: ptal in c.attribute_line_id
                ).id,
                create_variant=ptal.attribute_id.create_variant,
            ) for ptal in product_template.attribute_line_ids],
            exclusions=attribute_exclusions['exclusions'],
            archived_combinations=attribute_exclusions['archived_combinations'],
            parent_exclusions=attribute_exclusions['parent_exclusions'],
        )

    def _get_basic_product_information(self, product_or_template, pricelist, combination, **kwargs):
        """ Return basic information about a product

        :param recordset product_or_template: The product for which to seek information, as a
                                              `product.product` or `product.template` record.
        :param recordset|None pricelist: The pricelist to use, as a `product.pricelist` record.
        :param recordset combination: The combination of the product, as a
                                      `product.template.attribute.value` recordset.
        :param dict kwargs: Locally unused data passed to `_get_product_price`
        :rtype: dict
        :return: A dict with the following structure::
            {
                'id': int,  # if product_or_template is a record of `product.product`.
                'description_sale': str|False,
                'display_name': str,
                'price': float,
                'quantity': int,
            }
        """
        basic_information = dict(
            **product_or_template.read(['description_sale', 'display_name'])[0]
        )
        # If the product is a template, check the combination to compute the name to take dynamic
        # and no_variant attributes into account. Also, drop the id which was auto-included by the
        # search but isn't relevant since it is supposed to be the id of a `product.product` record.
        if not product_or_template.is_product_variant:
            basic_information.pop('id')
            combination_name = combination._get_combination_name()
            if combination_name:
                basic_information.update(
                    display_name=f"{basic_information['display_name']} ({combination_name})"
                )
        return dict(
            **basic_information,
            price=pricelist._get_product_price(
                product_or_template.with_context(
                    **product_or_template._get_product_price_context(combination)
                ),
                **kwargs,
            ),
        )
