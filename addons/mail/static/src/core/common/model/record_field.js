/* @odoo-module */

import { onChange } from "@mail/utils/common/misc";
import { ATTR_SYM, RECORD_FIELD_SYM, MANY_SYM, ONE_SYM, isAttr, isRelation } from "./misc";
import { RecordList } from "./record_list";

export class RecordField {
    /**
     * Combine both record fields, i.e. resulting data in both fields is union of both.
     *
     * @param {import("./record").Record} a
     * @param {import("./record").Record} b
     */
    static reconcile(a, b) {
        // Most recent values have precedence over old conflicting ones
        for (const fieldName of a._fields.keys()) {
            const aField = a._fields.get(fieldName);
            const bField = b._fields.get(fieldName);
            /** @type {RecordField} */
            let resField;
            if (aField && !bField) {
                resField = aField;
                b._customAssignThroughProxy = () => {
                    b._fields.set(fieldName, aField);
                };
            } else if (!aField && bField) {
                resField = bField;
                a._customAssignThroughProxy = () => {
                    a._fields.set(fieldName, bField);
                };
            } else if (!aField && !bField) {
                // none have been converted to record field... that means they have no value
            } else if (aField.ts > bField.ts) {
                resField = aField;
                b._customAssignThroughProxy = () => {
                    b._fields.set(fieldName, aField);
                };
            } else {
                resField = bField;
                a._customAssignThroughProxy = () => {
                    a._fields.set(fieldName, bField);
                };
            }
            if (aField) {
                aField.owner = b;
            }
            if (resField) {
                if (a._customAssignThroughProxy) {
                    a._2[fieldName] = resField.value;
                }
                if (b._customAssignThroughProxy) {
                    b._2[fieldName] = resField.value;
                }
            }
            if (isRelation(aField?.value) && isRelation(bField?.value)) {
                const field = b._fields.get(fieldName);
                /** @type {RecordList} */
                const aReclist = aField.value;
                /** @type {RecordList} */
                const bReclist = bField.value;
                aReclist.field = field;
                bReclist.field = field;
                RecordList.reconcile(aField.value, bField.value);
            }
        }
    }
    [RECORD_FIELD_SYM] = true;
    /** @type {import("./field_definition").FieldDefinition} */
    definition;
    /** @type {import("./record").Record} */
    owner;
    /** name the name of the field in the model definition */
    get name() {
        return this.definition.name;
    }
    /** true when this is an attribute, i.e. a non-relational field. */
    get [ATTR_SYM]() {
        return this.definition[ATTR_SYM];
    }
    /** true when this is a many relation. */
    get [MANY_SYM]() {
        return this.definition[MANY_SYM];
    }
    /** true when this is a one relation. */
    get [ONE_SYM]() {
        return this.definition[ONE_SYM];
    }
    /** the default value of this attribute. */
    default;
    /**
     * for computed field, invoking this function (re-)computes the field.
     *
     * @type {() => void}
     */
    compute;
    /** for computed field, determines whether the field is computing its value. */
    computing = false;
    /**
     * on computed field, calling this function makes a request to compute
     * the field. This doesn't necessarily mean the field is immediately re-computed: during an update cycle, this
     * is put in the compute FC_QUEUE and will be invoked at end.
     *
     * @type {() => void}
     */
    requestCompute;
    /**
     * on lazy-computed field, determines whether the field should be (re-)computed
     * when it's needed (i.e. accessed). Eager computed fields are immediately re-computed at end of update cycle,
     * whereas lazy computed fields wait extra for them being needed.
     */
    computeOnNeed = false;
    /** on lazy computed-fields, determines whether this field is needed (i.e. accessed). */
    computeInNeed = false;
    /**
     * for sorted field, invoking this function (re-)sorts the field.
     *
     * @type {() => void}
     */
    sort;
    /** for sorted field, determines whether the field is sorting its value. */
    sorting = false;
    /**
     * on sorted field, calling this function makes a request to sort
     * the field. This doesn't necessarily mean the field is immediately re-sorted: during an update cycle, this
     * is put in the sort FS_QUEUE and will be invoked at end.
     *
     * @type {() => void}
     */
    requestSort;
    /**
     * on lazy-sorted field, determines whether the field should be (re-)sorted
     * when it's needed (i.e. accessed). Eager sorted fields are immediately re-sorted at end of update cycle,
     * whereas lazy sorted fields wait extra for them being needed.
     */
    sortOnNeed = false;
    /** on lazy sorted-fields, determines whether this field is needed (i.e. accessed). */
    sortInNeed = false;
    /**
     * function that contains functions to be called when the value of field has changed, e.g. sort and onUpdate.
     *
     * @type {() => void}
     */
    onUpdate;
    /**
     * value of the field. Either its raw value if it's an attribute, or a RecordList if it's a relational field.
     *
     * @property {RecordList<Record>|any}
     */
    value;

    get eager() {
        return this.definition.eager;
    }
    ts;

    /** @param {Object} vals */
    constructor(vals) {
        const self = this;
        Object.assign(this, vals);
        this.ts = this.definition.NEXT_TS++;
        if (this.definition.Model.objectIdFields[this.name]) {
            if (isAttr(this.definition)) {
                onChange(this.owner._2, this.name, function RF_onChangeRecomputeObjectIds_attr() {
                    self.definition.Model.onRecomputeObjectIds(self.owner._1);
                });
            } else {
                // DELAYED because not access to record list yet, @see registerOnChangeRecomputeObjectId
            }
        }
    }
    registerOnChangeRecomputeObjectId() {
        const self = this;
        onChange(
            this.owner._2._fields.get(this.name).value.state,
            "data",
            function RF_onChangeRecomputeObjectIds_rel_data() {
                self.definition.Model.onRecomputeObjectIds(self.owner._1);
            }
        );
        onChange(
            this.owner._2._fields.get(this.name).value.state.data,
            "length",
            function RF_onChangeRecomputeObjectIds_rel_data_length() {
                self.definition.Model.onRecomputeObjectIds(self.owner._1);
            }
        );
    }
}
