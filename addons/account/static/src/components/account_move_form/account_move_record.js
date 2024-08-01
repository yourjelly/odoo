import { Record } from "@web/model/relational_model/record";

import { AccountMoveLineIdsStaticList } from "@account/components/account_move_form/account_move_line_ids_static_list";

export class AccountMoveRecord extends Record {

    setup(config, data, options = {}) {
        super.setup(...arguments);
        const self = this;
        this.evalContextWithVirtualIds = new Proxy(this.evalContextWithVirtualIds, {
            get(target, prop, receiver) {
                const results = Reflect.get(...arguments);
                if(prop === "context"){
                    results.invoice_line_ids_mode = self.model.invoiceLineIdsMode;
                }
                return results;
            },
        })
    }

    _handlerStaticList(){
        return {
            get(target, prop, receiver) {
                return Reflect.get(...arguments);
            },
        }
    }

    /**
     * Override
     * Custom instance of 'StaticList' for 'line_ids'.
     */
    _createStaticListDatapoint(data, fieldName) {
        const isLineIds = fieldName === "line_ids";
        const staticListClass = this.model.constructor.StaticList;
        if(isLineIds){
            this.model.constructor.StaticList = AccountMoveLineIdsStaticList;
        }
        const results = super._createStaticListDatapoint(...arguments);
        this.model.constructor.StaticList = staticListClass;
        return results;
    }

    /**
     * Override
     * 'invoice_line_ids' is a proxy to act like a subset of 'line_ids'.
     */
    _parseServerValues(serverValues, currentValues = {}) {
        const parsedValues = super._parseServerValues(serverValues, currentValues);

        const filterRecord = (record) => ["product", "line_section", "line_note"].includes(record.data.display_type);

        // Proxy line_ids => invoice_line_ids.
        if("line_ids" in parsedValues){
            parsedValues.invoice_line_ids = new Proxy(parsedValues.line_ids, this._handlerStaticList());
        }

        return parsedValues;
    }

}
