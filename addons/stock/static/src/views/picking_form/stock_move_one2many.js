/** @odoo-module **/

import { registry } from "@web/core/registry";
import { ListRenderer } from "@web/views/list/list_renderer";
import { X2ManyField, x2ManyField } from "@web/views/fields/x2many/x2many_field";
import { useEffect } from "@odoo/owl";
import { useOpenX2ManyRecord, useX2ManyCrud } from "@web/views/fields/relational_utils";

export class MovesListRenderer extends ListRenderer {
    static recordRowTemplate = "stock.MovesListRenderer.RecordRow";
    static props = [...ListRenderer.props, "stockMoveOpen?"];

    setup() {
        super.setup();
        useEffect(
            () => {
                this.keepColumnWidths = false;
            },
            () => [this.columns]
        );
    }

    processAllColumn(allColumns, list) {
        let cols = super.processAllColumn(...arguments);
        if (list.resModel === "stock.move") {
            cols.push({
                type: 'opendetailsop',
                id: `column_detailOp_${cols.length}`,
                column_invisible: 'parent.state=="draft"',
            });
        }
        return cols;
    }
}


export class StockMoveX2ManyField extends X2ManyField {
    static components = { ...X2ManyField.components, ListRenderer: MovesListRenderer };
    setup() {
        super.setup();
        this.canOpenRecord = true;

        const { updateRecord: superUpdateRecord } = useX2ManyCrud(
            () => this.list,
            this.isMany2Many
        );

        const updateRecord = async (record) => {
            if (record._config.resModel === 'stock.move'){
                await record.save({reload: true});
            }
            await superUpdateRecord(record);
        };

        const openRecord = useOpenX2ManyRecord({
            resModel: this.list.resModel,
            activeField: this.activeField,
            activeActions: this.activeActions,
            getList: () => this.list,
            updateRecord,
        });

        this._openRecord = async (params) => {
            await openRecord(params);
        };
    }

    get isMany2Many() {
        return false;
    }



    async openRecord(record) {
        if (this.canOpenRecord && !record.isNew) {
            const dirty = await record.isDirty();
            if (dirty && 'quantity' in record._changes || 'move_line_ids' in record._changes) {
                await record._parentRecord.save({ reload: true });
                record = record._parentRecord.data[this.props.name].records.find(e => e.resId === record.resId);
                if (!record) {
                    return;
                }
            }
        }
        return super.openRecord(record);
    }
}


export const stockMoveX2ManyField = {
    ...x2ManyField,
    component: StockMoveX2ManyField,
    additionalClasses: [...x2ManyField.additionalClasses || [], "o_field_one2many"],
};

registry.category("fields").add("stock_move_one2many", stockMoveX2ManyField);
