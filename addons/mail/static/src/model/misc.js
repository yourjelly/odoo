import { onChange } from "@mail/utils/common/misc";
import { markRaw, markup, reactive, toRaw } from "@odoo/owl";
import { deserializeDate, deserializeDateTime } from "@web/core/l10n/dates";
import { registry } from "@web/core/registry";

export const modelRegistry = registry.category("discuss.model");

/**
 * Class of markup, useful to detect content that is markup and to
 * automatically markup field during trusted insert
 */
const Markup = markup("").constructor;

/** @typedef {ATTR_SYM|MANY_SYM|ONE_SYM} FIELD_SYM */
const ATTR_SYM = Symbol("attr");
const MANY_SYM = Symbol("many");
const ONE_SYM = Symbol("one");
const OR_SYM = Symbol("or");
const AND_SYM = Symbol("and");
const IS_RECORD_SYM = Symbol("isRecord");
const IS_FIELD_SYM = Symbol("isField");
const IS_DELETED_SYM = Symbol("isDeleted");

export function AND(...args) {
    return [AND_SYM, ...args];
}
export function OR(...args) {
    return [OR_SYM, ...args];
}

/**
 * @param {Record} record
 * @param {Object} vals
 */
function updateFields(record, vals) {
    for (const [fieldName, value] of Object.entries(vals)) {
        const fieldDefinition = record.Model._fields.get(fieldName);
        if (!fieldDefinition || Record.isAttr(fieldDefinition)) {
            updateAttr(record, fieldName, value);
        } else {
            updateRelation(record, fieldName, value);
        }
    }
}

/**
 * @param {Record} record
 * @param {string} fieldName
 * @param {any} value
 */
function updateAttr(record, fieldName, value) {
    const fieldDefinition = record.Model._fields.get(fieldName);
    // ensure each field write goes through the proxy exactly once to trigger reactives
    const targetRecord = record._proxyUsed.has(fieldName) ? record : record._proxy;
    let shouldChange = record[fieldName] !== value;
    if (fieldDefinition?.type === "datetime" && value) {
        if (!(value instanceof luxon.DateTime)) {
            value = deserializeDateTime(value);
        }
        shouldChange = !record[fieldName] || !value.equals(record[fieldName]);
    }
    if (fieldDefinition?.type === "date" && value) {
        if (!(value instanceof luxon.DateTime)) {
            value = deserializeDate(value);
        }
        shouldChange = !record[fieldName] || !value.equals(record[fieldName]);
    }
    let newValue = value;
    if (fieldDefinition?.html && Record.trusted) {
        shouldChange =
            record[fieldName]?.toString() !== value?.toString() ||
            !(record[fieldName] instanceof Markup);
        newValue = typeof value === "string" ? markup(value) : value;
    }
    if (shouldChange) {
        record._updateFields.add(fieldName);
        targetRecord[fieldName] = newValue;
        record._updateFields.delete(fieldName);
    }
}

/**
 * @param {Record} record
 * @param {string} fieldName
 * @param {any} value
 */
function updateRelation(record, fieldName, value) {
    /** @type {RecordList<Record>} */
    const recordList = record._fields.get(fieldName).value;
    if (RecordList.isMany(recordList)) {
        updateRelationMany(recordList, value);
    } else {
        updateRelationOne(recordList, value);
    }
}

/**
 * @param {RecordList} recordList
 * @param {any} value
 */
function updateRelationMany(recordList, value) {
    if (Record.isCommand(value)) {
        for (const [cmd, cmdData] of value) {
            if (Array.isArray(cmdData)) {
                for (const item of cmdData) {
                    if (cmd === "ADD") {
                        recordList.add(item);
                    } else if (cmd === "ADD.noinv") {
                        recordList._addNoinv(item);
                    } else if (cmd === "DELETE.noinv") {
                        recordList._deleteNoinv(item);
                    } else {
                        recordList.delete(item);
                    }
                }
            } else {
                if (cmd === "ADD") {
                    recordList.add(cmdData);
                } else if (cmd === "ADD.noinv") {
                    recordList._addNoinv(cmdData);
                } else if (cmd === "DELETE.noinv") {
                    recordList._deleteNoinv(cmdData);
                } else {
                    recordList.delete(cmdData);
                }
            }
        }
    } else if ([null, false, undefined].includes(value)) {
        recordList.clear();
    } else if (!Array.isArray(value)) {
        recordList.assign([value]);
    } else {
        recordList.assign(value);
    }
}

/**
 * @param {RecordList} recordList
 * @param {any} value
 * @returns {boolean} whether the value has changed
 */
function updateRelationOne(recordList, value) {
    if (Record.isCommand(value)) {
        const [cmd, cmdData] = value.at(-1);
        if (cmd === "ADD") {
            recordList.add(cmdData);
        } else if (cmd === "ADD.noinv") {
            recordList._addNoinv(cmdData);
        } else if (cmd === "DELETE.noinv") {
            recordList._deleteNoinv(cmdData);
        } else {
            recordList.delete(cmdData);
        }
    } else if ([null, false, undefined].includes(value)) {
        recordList.clear();
    } else {
        recordList.add(value);
    }
}

function sortRecordList(recordListFullProxy, func) {
    const recordList = toRaw(recordListFullProxy)._raw;
    // sort on copy of list so that reactive observers not triggered while sorting
    const recordsFullProxy = recordListFullProxy.data.map((localId) =>
        recordListFullProxy.store.recordByLocalId.get(localId)
    );
    recordsFullProxy.sort(func);
    const data = recordsFullProxy.map((recordFullProxy) => toRaw(recordFullProxy)._raw.localId);
    const hasChanged = recordList.data.some((localId, i) => localId !== data[i]);
    if (hasChanged) {
        recordListFullProxy.data = data;
    }
}

/**
 * @typedef {Object} FieldDefinition
 * @property {boolean} [ATTR_SYM] true when this is an attribute, i.e. a non-relational field.
 * @property {boolean} [MANY_SYM] true when this is a many relation.
 * @property {boolean} [ONE_SYM] true when this is a one relation.
 * @property {any} [default] the default value of this attribute.
 * @property {boolean} [html] whether the attribute is an html field. Useful to automatically markup
 *   when the insert is trusted.
 * @property {string} [targetModel] model name of records contained in this relational field.
 * @property {() => any} [compute] if set the field is computed based on provided function.
 *   The `this` of function is the record, and the function is recalled whenever any field
 *   in models used by this compute function is changed. The return value is the new value of
 *   the field. On relational field, passing a (list of) record(s) or data work as expected.
 * @property {boolean} [eager=false] when field is computed, determines whether the computation
 *   of this field is eager or lazy. By default, fields are computed lazily, which means that
 *   they are computed when dependencies change AND when this field is being used. In eager mode,
 *   the field is immediately (re-)computed when dependencies changes, which matches the built-in
 *   behaviour of OWL reactive.
 * @property {string} [inverse] name of inverse relational field in targetModel.
 * @property {(r: Record) => void} [onAdd] hook that is called when relation is updated
 *   with a record being added. Callback param is record being added into relation.
 * @property {(r: Record) => void} [onDelete] hook that is called when relation is updated
 *   with a record being deleted. Callback param is record being deleted from relation.
 * @property {() => void} [onUpdate] hook that is called when field is updated.
 * @property {(r1: Record, r2: Record) => number} [sort] if defined, this many relational field is
 *   automatically sorted by this function.
 */
/**
 * @typedef {Object} RecordField
 * @property {string} name the name of the field in the model definition
 * @property {boolean} [ATTR_SYM] true when this is an attribute, i.e. a non-relational field.
 * @property {boolean} [MANY_SYM] true when this is a many relation.
 * @property {boolean} [ONE_SYM] true when this is a one relation.
 * @property {any} [default] the default value of this attribute.
 * @property {() => void} [compute] for computed field, invoking this function (re-)computes the field.
 * @property {boolean} [computing] for computed field, determines whether the field is computing its value.
 * @property {() => void} [requestCompute] on computed field, calling this function makes a request to compute
 *   the field. This doesn't necessarily mean the field is immediately re-computed: during an update cycle, this
 *   is put in the compute FC_QUEUE and will be invoked at end.
 * @property {boolean} [computeOnNeed] on lazy-computed field, determines whether the field should be (re-)computed
 *   when it's needed (i.e. accessed). Eager computed fields are immediately re-computed at end of update cycle,
 *   whereas lazy computed fields wait extra for them being needed.
 * @property {boolean} [computeInNeed] on lazy computed-fields, determines whether this field is needed (i.e. accessed).
 * @property {() => void} [sort] for sorted field, invoking this function (re-)sorts the field.
 * @property {boolean} [sorting] for sorted field, determines whether the field is sorting its value.
 * @property {() => void} [requestSort] on sorted field, calling this function makes a request to sort
 *   the field. This doesn't necessarily mean the field is immediately re-sorted: during an update cycle, this
 *   is put in the sort FS_QUEUE and will be invoked at end.
 * @property {boolean} [sortOnNeed] on lazy-sorted field, determines whether the field should be (re-)sorted
 *   when it's needed (i.e. accessed). Eager sorted fields are immediately re-sorted at end of update cycle,
 *   whereas lazy sorted fields wait extra for them being needed.
 * @property {boolean} [sortInNeed] on lazy sorted-fields, determines whether this field is needed (i.e. accessed).
 * @property {() => void} [onUpdate] function that contains functions to be called when the value of field
 *   has changed, e.g. sort and onUpdate.
 * @property {RecordList<Record>} [value] value of the field. Either its raw value if it's an attribute,
 *   or a RecordList if it's a relational field.
 */
