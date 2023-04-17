/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PurchaseOrderLineProductField } from '@purchase/js/purchase_product_field';
import { ProductMatrixDialog } from "@product_matrix/js/product_matrix_dialog";
import { useService } from "@web/core/utils/hooks";


patch(PurchaseOrderLineProductField.prototype, 'purchase_product_matrix', {

    setup() {
        this._super(...arguments);
        this.dialog = useService("dialog");
    },

    async _openGridConfigurator(mode) {
        const purchaseOrderRecord = this.props.record.model.root;

        // fetch matrix information from server;
        await purchaseOrderRecord.update({
            grid_product_tmpl_id: this.props.record.data.product_template_id,
        });

        let updatedLineAttributes = [];
        if (mode === 'edit') {
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
            purchaseOrderRecord.data.grid,
            this.props.record.data.product_template_id[0],
            updatedLineAttributes,
        );

        if (mode !== 'edit') {
            // remove new line used to open the matrix
            purchaseOrderRecord.data.order_line.removeRecord(this.props.record);
        }
    },

    async _openProductConfigurator(mode) {
        if (mode === 'edit' && this.props.record.data.product_add_mode == 'matrix') {
            this._openGridConfigurator('edit');
        } else {
            this._super(...arguments);
        }
    },

    /**
     * Triggers Matrix Dialog opening
     *
     * @param {String} jsonInfo matrix dialog content
     * @param {integer} productTemplateId product.template id
     * @param {editedCellAttributes} list of product.template.attribute.value ids
     *  used to focus on the matrix cell representing the edited line.
     *
     * @private
    */
    _openMatrixConfigurator: function (jsonInfo, productTemplateId, editedCellAttributes) {
        const infos = JSON.parse(jsonInfo);
        this.dialog.add(ProductMatrixDialog, {
            header: infos.header,
            rows: infos.matrix,
            editedCellAttributes: editedCellAttributes.toString(),
            product_template_id: productTemplateId,
            record: this.props.record.model.root,
        });
    },
});
