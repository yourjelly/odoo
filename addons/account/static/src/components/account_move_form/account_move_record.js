import { Record } from "@web/model/relational_model/record";

export class AccountMoveRecord extends Record {

//    _handlerStaticListRecords(records){
//        return {
//            get(target, prop, receiver) {
//                console.log(prop);
//                if(prop === "find"){
//                    debugger;
//                }
//                return Reflect.get(...arguments);
//            },
//        }
//    }

    _handlerStaticList(){
        const self = this;
        return {
            get(target, prop, receiver) {
//                if(prop === "records"){
////                    return Reflect.get(...arguments).filter(filterRecord);
//                    const records = Reflect.get(...arguments);
//                    return new Proxy(records, self._handlerStaticListRecords(records));
//                }else if(prop === "currentIds"){
//                    return Reflect.get(...arguments);
//                }
                return Reflect.get(...arguments);
            },
        }
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

    /**
     * Override
     * Track the changed field on lines.
     */
    async _update(changes) {
//        for(const fieldName of Object.keys(changes)){
//            if(this.resModel === "account.move.line"){
//                fieldName = `line_ids.${fieldName}`;
//            }
//            this.model.lineIdsChangedField = fieldName;
//        }
        return super._update(...arguments);
    }
}
