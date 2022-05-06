# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from odoo.http import Controller, request, route


class VariantController(Controller):

    @route(['/sale/get_combination_info'], type='json', auth="user", methods=['POST'])
    def get_combination_info(self, product_template_id, product_id, combination, add_qty, pricelist_id, **kw):
        ProductTemplate = request.env['product.template']
        ProductTemplateAttributeValue = request.env['product.template.attribute.value']

        combination = ProductTemplateAttributeValue.browse(combination)
        pricelist = self._get_pricelist(pricelist_id)

        product_template = ProductTemplate.browse(int(product_template_id))
        res = product_template._get_combination_info(
            combination,
            int(product_id or 0),
            int(add_qty or 1),
            pricelist,
        )
        # TODO VFE investigate parent_combination, and see if get_combination_info results are fully needed
        # Also, see if we shouldn't move the combination var update before the _get_combination_info call
        if 'parent_combination' in kw:
            parent_combination = ProductTemplateAttributeValue.browse(kw.get('parent_combination'))
            if not combination.exists() and product_id:
                product = request.env['product.product'].browse(int(product_id))
                if product.exists():
                    combination = product.product_template_attribute_value_ids
            res.update({
                'is_combination_possible': product_template._is_combination_possible(
                    combination=combination,
                    parent_combination=parent_combination,
                ),
                'parent_exclusions': product_template._get_parent_attribute_exclusions(
                    parent_combination=parent_combination
                )
            })
        return res

    @route(['/sale/create_product_variant'], type='json', auth="user", methods=['POST'])
    def create_product_variant(self, product_template_id, product_template_attribute_value_ids, **kwargs):
        return request.env['product.template'].browse(int(product_template_id)).create_product_variant(json.loads(product_template_attribute_value_ids))

    def _get_pricelist(self, pricelist_id, pricelist_fallback=False):
        return request.env['product.pricelist'].browse(int(pricelist_id or 0))
