/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { registry } from '@web/core/registry';
import { Many2OneField, many2OneField } from '@web/views/fields/many2one/many2one_field';
// import { SaleOrderLineProductField } from '@sale/js/sale_product_field';
import { PurchaseOrderLineProductField } from '@purchase/js/purchase_product_field';
import { ProductMatrixDialog } from "@product_matrix/js/product_matrix_dialog";
import { useService } from "@web/core/utils/hooks";

const { onWillUpdateProps } = owl;


// export class PurchaseOrderLineProductField extends Many2OneField {
patch(PurchaseOrderLineProductField.prototype, 'purchase_product_matrix', {

    setup() {
        // super.setup();
        this._super(...arguments);
        this.dialog = useService("dialog");
        // this.currentValue = this.value;
    },

    //     onWillUpdateProps(async (nextProps) => {
    //         if (nextProps.record.mode === 'edit' && nextProps.record.data[nextProps.name]) {
    //             if (
    //                 !this.currentValue ||
    //                 this.currentValue[0] != nextProps.record.data[nextProps.name][0]
    //             ) {
    //                 // Field was updated if line was open in edit mode,
    //                 //      field is not emptied,
    //                 //      new value is different than existing value.
    //                 debugger;
    //                 this._onProductTemplateUpdate();
    //             }
    //         }
    //         this.currentValue = nextProps.record.data[nextProps.name];
    //     });
    // },

    // get configurationButtonHelp() {
    //     return this.env._t("Edit Configuration");
    // },
    // get isConfigurableTemplate() {
    //     return this.props.record.data.is_configurable_product;
    // },

    async _openGridConfigurator(edit) {
        const PurchaseOrderRecord = this.props.record.model.root;
        debugger
        // fetch matrix information from server;
        await PurchaseOrderRecord.update({
            grid_product_tmpl_id: this.props.record.data.product_template_id,
        });

        let updatedLineAttributes = [];
        if (edit) {
            // provide attributes of edited line to automatically focus on matching cell in the matrix
            for (let ptnvav of this.props.record.data.product_no_variant_attribute_value_ids.records) {
                updatedLineAttributes.push(ptnvav.data.id);
            }
            for (let ptav of this.props.record.data.product_template_attribute_value_ids.records) {
                updatedLineAttributes.push(ptav.data.id);
            }
            updatedLineAttributes.sort((a, b) => { return a - b; });
        }

        this._openMatrixConfigurator(
            PurchaseOrderRecord.data.grid,
            this.props.record.data.product_template_id[0],
            updatedLineAttributes,
        );

        if (!edit) {
            // remove new line used to open the matrix
            PurchaseOrderRecord.data.order_line.removeRecord(this.props.record);
        }
    },

    async _openProductConfigurator(edit=false) {
        if (edit && this.props.record.data.purchase_add_mode == 'matrix') {
            this._openGridConfigurator(true);
        } else {
            this._super(...arguments);
        }
    },

    _openMatrixConfigurator(jsonInfo, productTemplateId, editedCellAttributes) {
        const infos = JSON.parse(jsonInfo);
        this.dialog.add(ProductMatrixDialog, {
            header: infos.header,
            rows: infos.matrix,
            editedCellAttributes: editedCellAttributes.toString(),
            product_template_id: productTemplateId,
            record: this.props.record.model.root,
        });
    }
});

// PurchaseOrderLineProductField.template = "purchase.PurchaseProductField";

// export const purchaseOrderLineProductField = {
//     ...many2OneField,
//     component: PurchaseOrderLineProductField,
// };

// registry.category("fields").add("pol_product_many2one", purchaseOrderLineProductField);
