/** @odoo-module **/
import { Reactive } from "@web/core/utils/reactive";

export class Product extends Reactive {
    constructor(
        {
            price_info,
            has_image,
            attributes,
            name,
            display_name,
            id,
            description_self_order,
            pos_categ_ids,
            pos_combo_ids,
            is_pos_groupable,
            write_date,
            self_order_available,
            product_template_variant_value_ids,
            product_tmpl_id,
            archived_combinations,
        },
        showPriceTaxIncluded
    ) {
        super();
        this.setup(...arguments);
    }

    setup(product, showPriceTaxIncluded) {
        // server data
        this.id = product.id;
        this.price_info = product.price_info;
        this.has_image = product.has_image;
        this.attributes = product.attributes;
        this.name = product.name;
        this.display_name = product.display_name;
        this.description_self_order = product.description_self_order;
        this.pos_categ_ids = product.pos_categ_ids;
        this.pos_combo_ids = product.pos_combo_ids;
        this.is_pos_groupable = product.is_pos_groupable;
        this.write_date = product.write_date;
        this.self_order_available = product.self_order_available;
        this.barcode = product.barcode;
        this.product_template_variant_value_ids = product.product_template_variant_value_ids;
        this.product_tmpl_id = product.product_tmpl_id;
        this.archived_combinations = product.archived_combinations;

        // data
        this.showPriceTaxIncluded = showPriceTaxIncluded;
    }

    get isCombo() {
        return this.pos_combo_ids;
    }

    _isArchivedCombination(attributeValueIds) {
        if (!this.archived_combinations) {
            return false;
        }
        const excludedPTAV = new Set();
        let isCombinationArchived = false;
        for (const archivedCombination of this.archived_combinations) {
            const ptavCommon = archivedCombination.filter((ptav) =>
                attributeValueIds.includes(ptav)
            );
            if (ptavCommon.length === attributeValueIds.length) {
                // all attributes must be disabled from each other
                archivedCombination.forEach((ptav) => excludedPTAV.add(ptav));
            } else if (ptavCommon.length === attributeValueIds.length - 1) {
                // In this case we only need to disable the remaining ptav
                const disablePTAV = archivedCombination.find(
                    (ptav) => !attributeValueIds.includes(ptav)
                );
                excludedPTAV.add(disablePTAV);
            }
            this.attributes.forEach((attribute_line) => {
                attribute_line.values.forEach((ptav) => {
                    ptav["excluded"] = excludedPTAV.has(ptav.id);
                });
            });
            if (ptavCommon.length === attributeValueIds.length) {
                isCombinationArchived = true;
            }
        }
        return isCombinationArchived;
    }
}
