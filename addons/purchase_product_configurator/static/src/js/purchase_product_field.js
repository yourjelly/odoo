/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { PurchaseOrderLineProductField } from '@purchase/js/purchase_product_field';
import { serializeDateTime } from "@web/core/l10n/dates";
import { ProductConfiguratorDialog } from "./product_configurator_dialog/product_configurator_dialog";

patch(PurchaseOrderLineProductField.prototype, 'purchase_product_configurator', {

    setup() {
        this._super(...arguments);

        this.dialog = useService("dialog");
        this.orm = useService("orm");
    },

    async _onProductTemplateUpdate() {
        this._super(...arguments);
        let ctx = this.context;
        ctx["from_purchase"] = true;
        const result = await this.orm.call(
            'product.template',
            'get_single_purchase_product_variant',
            [this.props.record.data.product_template_id[0]],
            {
                context: this.context,
            }
        );
        debugger;
        if(result && result.product_id) {
            if (this.props.record.data.product_id != result.product_id.id) {
                await this.props.record.update({
                    product_id: [result.product_id, result.product_name],
                });
                if (result.has_optional_products) {
                    this._openProductConfigurator();
                } else {
                    this._onProductUpdate();
                }
            }
        } else {
            // debugger;
            if (!result.mode || result.mode === 'configurator') {
                this._openProductConfigurator(false);
            } else {
                // only triggered when purchase_product_matrix is installed.
                this._openGridConfigurator(false);
            }
        }
    },

    _editProductConfiguration() {
        this._super(...arguments);
        debugger;
        if (this.props.record.data.is_configurable_product) {
            if (!result.mode || result.mode === 'configurator') {
                this._openProductConfigurator(true);
            } else {
                // only triggered when purchase_product_matrix is installed.
                this._openGridConfigurator(true);
            }
        }
    },

    get isConfigurableTemplate() {
        return this._super(...arguments) || this.props.record.data.is_configurable_product;
    },

    async _openProductConfigurator(edit=false) {
        const purchaseOrderRecord = this.props.record.model.root;

        /**
         *  `product_custom_attribute_value_ids` records are not loaded in the view bc sub templates
         *  are not loaded in list views. Therefore, we fetch them from the server if the record is
         *  saved. Else we use the value stored on the line.
         */
        const customAttributeValues =
            this.props.record.data.product_custom_attribute_value_ids.records[0]?.isNew ?
            this.props.record.data.product_custom_attribute_value_ids.records.map(
                record => record.data
            ) :
            await this.orm.read(
                'product.attribute.custom.value',
                this.props.record.data.product_custom_attribute_value_ids.currentIds,
                ["custom_product_template_attribute_value_id", "custom_value"]
            );
        // debugger;
        this.dialog.add(ProductConfiguratorDialog, {
            productTemplateId: this.props.record.data.product_template_id[0],
            ptavIds: this.props.record.data.product_template_attribute_value_ids.records.map(
                record => record.data.id
            ).concat(this.props.record.data.product_no_variant_attribute_value_ids.records.map(
                record => record.data.id
            )),
            customAttributeValues: customAttributeValues.map(
                data => {
                    return {
                        ptavId: data.custom_product_template_attribute_value_id[0],
                        value: data.custom_value,
                    }
                }
            ),
            quantity: this.props.record.data.product_qty,
            productUOMId: this.props.record.data.product_uom[0],
            companyId: purchaseOrderRecord.data.company_id[0],
            // pricelistId: purchaseOrderRecord.data.pricelist_id[0],
            currencyId: this.props.record.data.currency_id[0],
            soDate: serializeDateTime(purchaseOrderRecord.data.date_order),
            edit: edit,
            save: async (mainProduct, optionalProducts) => {
                debugger;
                await this.props.record.update(mainProduct);
                
                await this.props.record.update({product_qty: mainProduct.product_qty});
                this._onProductUpdate();
                for (const optionalProduct of optionalProducts) {
                    const line = await purchaseOrderRecord.data.order_line.addNew({
                        position: 'bottom',
                    });
                    line.update(optionalProduct);
                }
                purchaseOrderRecord.data.order_line.unselectRecord();
            },
            discard: () => {
                purchaseOrderRecord.data.order_line.removeRecord(this.props.record);
            },
        });
    },
});
