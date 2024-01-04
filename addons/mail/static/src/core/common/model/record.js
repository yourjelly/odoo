/* @odoo-module */

import { markRaw, toRaw } from "@odoo/owl";
import { RecordList } from "./record_list";
import { RecordUses } from "./record_uses";
import {
    ATTR_SYM,
    MANY_SYM,
    ONE_SYM,
    modelRegistry,
    _0,
    isCommand,
    isMany,
    isOne,
    isRecord,
    isRelation,
    VERSION,
} from "./misc";
import { DeprecatedRecord } from "./deprecated_record";
import { FieldDefinition } from "./field_definition";
import { RecordField } from "./record_field";

export class Record {
    /**
     * Expression to define how records on the model are identified.
     * Supported value:
     * - string with single field name
     * - non-nested AND/OR expressions with field names. see AND|OR functions
     * - list with the above values except OR expression (each items are disjunctive, i.e. joined with OR)
     *
     * @type {string|AND|OR|Array<string|AND>}
     */
    static id;
    /**
     * Normalized version of static id.
     * Should not be defined by business code, as this is deduced from provided static id.
     * It contains a list whose item are lists of string.
     * 1st-level depth of listing is a "OR" between items, and 2nd-level depth of
     * listing is an "AND" between items.
     * This _id is simpler to navigate than static id which is a sort of Domain-Specific-Language.
     * To avoid parsing it again and again, static _id is preferred for internal code.
     *
     * @type {Array<string[]>}
     */
    static _id;
    /**
     * List of fields that contribute to object ids.
     * Should not be defined by business code, as this is deduced from provided static id.
     * Useful to track when their value change on a record, to adapt object id that maps to
     * this record... and maybe need to reconcile with another existing record that has the
     * same identity!
     *
     * @type {string[]}
     */
    static objectIdFields = [];
    /**
     * in VERSION 0: key is legacy localId, e.g. "Persona, partner AND 3"
     * in VERSION 1: key is the local objectId, basically ModelName{number}(SELF_ID)[VERSION], e.g. "Persona{200}(123456789)[1]"
     *
     * @type {Object<string, Record>}
     */
    static records;
    /** @type {import("models").Store} */
    static store;
    /** @type {import("models").Store} */
    static store0;
    static NEXT_LOCAL_ID = 1;
    /**
     * A UUID/GUI of the current record manager. Useful to determine whether a local id comes from itself of others.
     * Self local ids have easy access and do not change local identity (small exception with reconciliation, but
     * the local ids persist until the record is fully deleted)
     */
    static SELF_ID = 0; //`${new Date().getTime()}:::${Math.random()}`;
    /**
     * Whether there's only at most 1 record of this model.
     * Useful to simply insert on such record without having to define a dummy id and making sure it's the same value passed.
     * `undefined` values are not elligible as non-local object id, and non-singleton models will refuse to insert a record
     * without at least one non-local object id.
     */
    static singleton = false;
    /** @param {() => any} fn */
    static MAKE_UPDATE(fn) {
        return this.store0.MAKE_UPDATE(fn);
    }
    static onChange(record, name, cb) {
        const store0 = this.store0;
        return store0._onChange(record, name, (observe) => {
            const fn = () => {
                observe();
                cb();
            };
            if (store0.UPDATE !== 0) {
                if (!store0.RO_QUEUE.some((f) => toRaw(f) === fn)) {
                    store0.RO_QUEUE.push(fn);
                }
            } else {
                fn();
            }
        });
    }
    /**
     * Contains field definitions of the model:
     * - key : field name
     * - value: Value contains definition of field
     *
     * @type {Map<string, FieldDefinition>}
     */
    static _fields;
    static isRecord(record) {
        return isRecord(record);
    }
    static get(data) {
        const this0 = _0(this);
        return this.records[this0.dataToLocalId(data)];
    }
    /** Find the local id from data on current model (if exists) */
    static dataToLocalId(data) {
        const this0 = _0(this);
        if (VERSION.CURRENT === 0) {
            return this.localId(data);
        }
        let localId;
        if (this0.singleton) {
            return Object.keys(this0.records)[0];
        }
        if (typeof data !== "object" || data === null) {
            // special shorthand when record has a single single-id primitive.
            // Note that this is not working on object field due to ambiguity
            // on whether it targets this single-id or data are on self object.
            const singleIds = this0._id.filter((item) => item.length === 1).map((item) => item[0]);
            if (singleIds.length !== 1) {
                throw new Error(`
                    Model "${this0.name}" has more than one single-id.
                    Shorthand to get/insert records with non-object is only supported with a single single-id.
                    Found singleIds: ${singleIds.map((item) => item[0]).join(",")}
                `);
            }
            return this.dataToLocalId({ [singleIds[0]]: data });
        }
        for (let i = 0; i < this0._id.length && !localId; i++) {
            const expr = this0._id[i];
            if (expr.some((item) => !(item in data))) {
                continue;
            }
            this._retrieveObjectIdsFromExpr(expr, data, {
                earlyStop: () => localId,
                onObjectId: (objectId) => {
                    localId = this0.store0.objectIdToLocalId.get(objectId);
                },
            });
        }
        return localId;
    }
    /**
     * Compute object ids of the record, without updating them.
     * Useful to compare with old object ids and determine strategy to
     * update them and/or reconcile records if needed.
     *
     * @param {Record} record
     */
    static recordToObjectIds(record) {
        const this0 = _0(this);
        const objectIds = [...record.localIds];
        for (let i = 0; i < this0._id.length; i++) {
            const expr = this0._id[i];
            if (expr.some((item) => record[item] === undefined)) {
                continue;
            }
            this._retrieveObjectIdsFromExpr(expr, record, {
                onObjectId: (objectId) => {
                    objectIds.push(objectId);
                },
            });
        }
        return objectIds;
    }
    /**
     * @param {string[]} expr part of an AND expression in model ids. See static _id
     * @param {Object|Record} data
     * @param {Object} [param2={}]
     * @param {() => boolean} [param2.earlyStop] if provided, truthy value means the retrieve
     *   process should stop. Useful when using this function requires to only find a
     *   single match.
     * @param {(string) => void} [param2.onObjectId] if provided, called whenever an object id
     *   has been retrieved by this function. Param is the currently retrieved object id.
     */
    static _retrieveObjectIdsFromExpr(expr, data, { earlyStop, onObjectId } = {}) {
        const this0 = _0(this);
        // Try each combination of potential objectId, using all localIds of relations
        const fields = expr.map((item) => ({
            name: item,
            relation: isRelation(this0._fields.get(item)),
        }));
        const fieldToIndex = Object.fromEntries(
            fields.filter((f) => f.relation).map((f, index) => [f.name, index])
        );
        const fcounts = fields.map((field) => (field.relation ? 0 : -1));
        const iteration = { value: 0 };
        const MAX_ITER = 1000;

        const loop = function (index, ...fcounts2) {
            /** @param {string} name */
            const getRelatedRecord = function (name) {
                if (isRecord(data[name])) {
                    return data[name];
                } else if (isCommand(data[name])) {
                    const param2 = data[name]?.[0]?.at(-1);
                    if (!param2) {
                        return;
                    } else if (isRecord(param2)) {
                        return param2;
                    }
                    const { targetModel } = this0._fields.get(name);
                    return this0.store0[targetModel].get(param2);
                } else if ([null, false, undefined].includes(data[name])) {
                    return undefined;
                } else {
                    const { targetModel } = this0._fields.get(name);
                    return this0.store0[targetModel].get(data[name]);
                }
            };
            if (index >= fields.length) {
                let ok = true;
                const fieldVals = expr
                    .map((item) => {
                        if (isRelation(this0._fields.get(item))) {
                            const i = fcounts2[fieldToIndex[item]];
                            const relatedRecord = getRelatedRecord(item);
                            if (!relatedRecord) {
                                ok = false;
                                return;
                            }
                            return `${item}: (${relatedRecord.localIds[i]})`;
                        } else {
                            return `${item}: ${data[item]}`;
                        }
                    })
                    .join(", ");
                if (!ok) {
                    return;
                }
                const objectId = `${this0.name}{${fieldVals}}(${Record.SELF_ID})[${VERSION.CURRENT}]`;
                onObjectId?.(objectId);
                iteration.value++;
                return;
            }
            const fieldName = fields[index].name;
            if (!fields[index].relation) {
                return loop(index + 1, ...fcounts2);
            }
            const relatedRecord = getRelatedRecord(fieldName);
            if (!relatedRecord) {
                return; // not a candidate
            }
            for (
                let i = 0;
                i < relatedRecord.localIds.length && !earlyStop?.() && iteration.value < MAX_ITER;
                i++
            ) {
                loop(index + 1, ...fcounts2);
            }
        };
        loop(0, ...fcounts);
        if (iteration.value === MAX_ITER) {
            throw new Error("Too many reconciled records with residual data");
        }
    }
    static register() {
        modelRegistry.add(this.name, this);
    }
    /** @deprecated */
    static localId(data) {
        return DeprecatedRecord.localId.call(this, ...arguments);
    }
    static _localId(expr, data, { brackets = false } = {}) {
        return DeprecatedRecord._localId.call(this, ...arguments);
    }
    static _retrieveIdFromData(data) {
        const this0 = _0(this);
        const res = {};
        function _deepRetrieve(expr2) {
            if (typeof expr2 === "string") {
                if (isCommand(data[expr2])) {
                    // Note: only R.one() is supported
                    const [cmd, data2] = data[expr2].at(-1);
                    return Object.assign(res, {
                        [expr2]:
                            cmd === "DELETE"
                                ? undefined
                                : cmd === "DELETE.noinv"
                                ? [["DELETE.noinv", data2]]
                                : cmd === "ADD.noinv"
                                ? [["ADD.noinv", data2]]
                                : data2,
                    });
                }
                return Object.assign(res, { [expr2]: data[expr2] });
            }
            if (expr2 instanceof Array) {
                for (const expr of this.id) {
                    if (typeof expr === "symbol") {
                        continue;
                    }
                    _deepRetrieve(expr);
                }
            }
        }
        if (this0.id === undefined) {
            return res;
        }
        if (typeof this0.id === "string") {
            if (typeof data !== "object" || data === null) {
                return { [this0.id]: data }; // non-object data => single id
            }
            if (isCommand(data[this0.id])) {
                // Note: only one() is supported
                const [cmd, data2] = data[this0.id].at(-1);
                return Object.assign(res, {
                    [this0.id]:
                        cmd === "DELETE"
                            ? undefined
                            : cmd === "DELETE.noinv"
                            ? [["DELETE.noinv", data2]]
                            : cmd === "ADD.noinv"
                            ? [["ADD.noinv", data2]]
                            : data2,
                });
            }
            return { [this0.id]: data[this0.id] };
        }
        for (const expr of this0.id) {
            if (typeof expr === "symbol") {
                continue;
            }
            _deepRetrieve(expr);
        }
        return res;
    }
    /**
     * Technical attribute, DO NOT USE in business code.
     * This class is almost equivalent to current class of model,
     * except this is a function, so we can new() it, whereas
     * `this` is not, because it's an object.
     * (in order to comply with OWL reactivity)
     *
     * @type {typeof Record}
     */
    static Class;
    /**
     * This method is almost equivalent to new Class, except that it properly
     * setup relational fields of model with get/set, @see Class
     *
     * @returns {Record}
     */
    static new(data) {
        const this0 = _0(this);
        const store0 = this0.store0;
        return store0.MAKE_UPDATE(function R_new() {
            const rec1 = new this0.Class();
            const rec0 = _0(rec1);
            let localId;
            if (VERSION.CURRENT === 0) {
                localId = DeprecatedRecord.new_1.call(this, rec1, data);
            } else {
                localId = `${this0.name}{${this0.NEXT_LOCAL_ID++}}(${Record.SELF_ID})[${
                    VERSION.CURRENT
                }]`;
                Object.assign(rec1, {
                    localIds: [localId],
                    objectIds: [localId],
                });
            }
            this0.records[rec0.localId] = rec1;
            if (rec0.Model.name === "Store") {
                Object.assign(rec0, {
                    env: store0.env,
                    objectIdToLocalId: store0.objectIdToLocalId,
                    localIdToRecord: store0.localIdToRecord,
                });
            }
            store0.localIdToRecord.set(rec0.localId, rec1);
            store0.objectIdToLocalId.set(rec0.localId, rec0.localId);
            for (const field of rec0._fields.values()) {
                field.requestCompute?.();
                field.requestSort?.();
            }
            return rec1;
        });
    }
    /** @param {Record} rec1 */
    static onRecomputeObjectIds(rec1) {
        const this0 = _0(this);
        const rec0 = _0(rec1);
        const store0 = this0.store0;
        // 1. compute object ids
        const objectIds = this0.recordToObjectIds(rec1);
        const oldObjectIds = rec0.objectIds.filter((objectId) => !objectIds.includes(objectId));
        const newObjectIds = objectIds.filter((objectId) => !rec0.objectIds.includes(objectId));
        // 2. old object ids => remove the mapping
        for (const oldOid of oldObjectIds) {
            rec0.objectIds = rec0.objectIds.filter((oid) => oid !== oldOid);
            store0.objectIdToLocalId.delete(oldOid);
        }
        // 3. new object ids
        for (const newOid of newObjectIds) {
            if (store0.objectIdToLocalId.get(newOid)) {
                // Detected other record matching same identity => reconcile
                const otherRec = _0(
                    _0(store0.localIdToRecord).get(store0.objectIdToLocalId.get(newOid))
                );
                if (!rec0._reconciling && !otherRec._reconciling) {
                    this0.reconcile(rec0, otherRec);
                }
            }
            rec0.objectIds.push(newOid);
            store0.objectIdToLocalId.set(newOid, rec0.localId);
        }
    }
    /**
     * @param {Record} a record that triggered same identity detection
     * @param {Record} b record that has been detected as having same identity
     */
    static reconcile(a, b) {
        a._reconciling = true;
        b._reconciling = true;
        const this0 = _0(this);
        const store0 = this0.store0;
        for (const localId of a.localIds) {
            store0.localIdToRecord.set(localId, b._1);
            b.localIds.push(localId);
        }
        for (const objectId of a.objectIds) {
            store0.objectIdToLocalId.set(objectId, b.localId);
        }
        a.localIds = b.localIds;
        a.objectIds = b.objectIds;
        a._redirectedRecord = b._2;
        RecordField.reconcile(a, b);
        RecordUses.reconcile(a, b);
        // TODO combine _updatingAttrs
        a._updatingAttrs = b._updatingAttrs;
        // TODO combine _updatingFieldsThroughProxy
        a._updatingFieldsThroughProxy = b._updatingFieldsThroughProxy;
        a._0 = b._0;
        a._1 = b._1;
        a._2 = b._2;
        a._reconciling = false;
        b._reconciling = false;
    }
    /**
     * @template {keyof import("models").Models} M
     * @param {M} targetModel
     * @param {Object} [param1={}]
     * @param {Function} [param1.compute] if set, the value of this relational field is declarative and
     *   is computed automatically. All reactive accesses recalls that function. The context of
     *   the function is the record. Returned value is new value assigned to this field.
     * @param {boolean} [param1.eager=false] when field is computed, determines whether the computation
     *   of this field is eager or lazy. By default, fields are computed lazily, which means that
     *   they are computed when dependencies change AND when this field is being used. In eager mode,
     *   the field is immediately (re-)computed when dependencies changes, which matches the built-in
     *   behaviour of OWL reactive.
     * @param {string} [param1.inverse] if set, the name of field in targetModel that acts as the inverse.
     * @param {(r: import("models").Models[M]) => void} [param1.onAdd] function that is called when a record is added
     *   in the relation.
     * @param {(r: import("models").Models[M]) => void} [param1.onDelete] function that is called when a record is removed
     *   from the relation.
     * @param {() => void} [param1.onUpdate] function that is called when the field value is updated.
     *   This is called at least once at record creation.
     * @returns {import("models").Models[M]}
     */
    static one(targetModel, param1) {
        return new FieldDefinition({ ...param1, targetModel, [ONE_SYM]: true });
    }
    /**
     * @template {keyof import("models").Models} M
     * @param {M} targetModel
     * @param {Object} [param1={}]
     * @param {Function} [param1.compute] if set, the value of this relational field is declarative and
     *   is computed automatically. All reactive accesses recalls that function. The context of
     *   the function is the record. Returned value is new value assigned to this field.
     * @param {boolean} [param1.eager=false] when field is computed, determines whether the computation
     *   of this field is eager or lazy. By default, fields are computed lazily, which means that
     *   they are computed when dependencies change AND when this field is being used. In eager mode,
     *   the field is immediately (re-)computed when dependencies changes, which matches the built-in
     *   behaviour of OWL reactive.
     * @param {string} [param1.inverse] if set, the name of field in targetModel that acts as the inverse.
     * @param {(r: import("models").Models[M]) => void} [param1.onAdd] function that is called when a record is added
     *   in the relation.
     * @param {(r: import("models").Models[M]) => void} [param1.onDelete] function that is called when a record is removed
     *   from the relation.
     * @param {() => void} [param1.onUpdate] function that is called when the field value is updated.
     *   This is called at least once at record creation.
     * @param {(r1: import("models").Models[M], r2: import("models").Models[M]) => number} [param1.sort] if defined, this field
     *   is automatically sorted by this function.
     * @returns {import("models").Models[M][]}
     */
    static many(targetModel, param1) {
        return new FieldDefinition({ ...param1, targetModel, [MANY_SYM]: true });
    }
    /**
     * @template T
     * @param {T} def
     * @param {Object} [param1={}]
     * @param {Function} [param1.compute] if set, the value of this attr field is declarative and
     *   is computed automatically. All reactive accesses recalls that function. The context of
     *   the function is the record. Returned value is new value assigned to this field.
     * @param {boolean} [param1.eager=false] when field is computed, determines whether the computation
     *   of this field is eager or lazy. By default, fields are computed lazily, which means that
     *   they are computed when dependencies change AND when this field is being used. In eager mode,
     *   the field is immediately (re-)computed when dependencies changes, which matches the built-in
     *   behaviour of OWL reactive.
     * @param {boolean} [param1.html] if set, the field value contains html value.
     *   Useful to automatically markup when the insert is trusted.
     * @param {() => void} [param1.onUpdate] function that is called when the field value is updated.
     *   This is called at least once at record creation.
     * @param {(Object, Object) => number} [param1.sort] if defined, this field is automatically sorted
     *   by this function.
     * @returns {T}
     */
    static attr(def, param1) {
        return new FieldDefinition({ ...param1, [ATTR_SYM]: true, default: def });
    }
    /** @returns {Record|Record[]} */
    static insert(data, options = {}) {
        const this3 = this;
        const this0 = _0(this3);
        const store0 = this0.store0;
        return store0.MAKE_UPDATE(function R_insert() {
            const isMulti = Array.isArray(data);
            if (!isMulti) {
                data = [data];
            }
            const oldTrusted = store0.trusted;
            store0.trusted = options.html ?? store0.trusted;
            const res = data.map(function R_insert_map(d) {
                return this0._insert.call(this3, d, options);
            });
            store0.trusted = oldTrusted;
            if (!isMulti) {
                return res[0];
            }
            return res;
        });
    }
    /** @returns {Record} */
    static _insert(data) {
        const this3 = this;
        const this0 = _0(this3);
        const record3 = this0.preinsert.call(this3, data);
        const record = _0(record3);
        record.update.call(record._2, data);
        return record3;
    }
    /**
     * @param {Object} data
     * @returns {Record}
     */
    static preinsert(data) {
        const this3 = this;
        const this0 = _0(this3);
        return this0.get.call(this3, data) ?? this0.new(data);
    }
    // Internal props on instance. Important to not have them being registered as fields!
    static INSTANCE_INTERNALS = {
        _reconciling: true,
        _customAssignThroughProxy: true,
        _redirectedRecord: true,
        _fields: true,
        _updatingFieldsThroughProxy: true,
        _updatingAttrs: true,
        __uses__: true,
        Model: true,
        localIds: true,
        objectIds: true,
        _0: true,
        _1: true,
        _2: true,
        // store-specific
        localIdToRecord: true,
        objectIdToLocalId: true,
        Models: true,
    };

    _reconciling = false;
    /** @type {() => void>} */
    _customAssignThroughProxy;
    /** @type {boolean} */
    _redirectedRecord;
    /** @type {Map<string, import("./record_field").RecordField>}*/
    _fields = new Map();
    /** @type {Set<string>} */
    _updatingFieldsThroughProxy;
    /** @type {Set<string>} */
    _updatingAttrs;
    __uses__ = markRaw(new RecordUses());
    get _store() {
        return _0(this).Model.store0._2;
    }
    get _store0() {
        return _0(this).Model.store0;
    }
    /**
     * Technical attribute, contains the Model entry in the store.
     * This is almost the same as the class, except it's an object
     * (so it works with OWL reactivity), and it's the actual object
     * that store the records.
     *
     * Indeed, `this.constructor.records` is there to initiate `records`
     * on the store entry, but the class `static records` is not actually
     * used because it's non-reactive, and we don't want to persistently
     * store records on class, to make sure different tests do not share
     * records.
     *
     * @type {typeof Record}
     */
    Model;
    /**
     * The referenced local id of the record.
     *
     * In VERSION 0: legacy format:
     *    ModelName,OrderedExpressionEvaluationOfIdValues
     *    e.g. "Persona,partner AND 3"
     * In VERSION 1: local object id:
     *    ModelName{number}(SELF_ID)[VERSION]
     *    e.g. "Persona{20}(123456789)[1]"
     *
     * @type {string}
     */
    get localId() {
        return this.localIds[0];
    }
    /**
     * List of all local ids related to this record.
     * Most of time records only have a single local id.
     * Multiple local ids happen when 2 or more records happen
     * to share same identity and they have being reconciled.
     * Eventually record will keep a single local id, but to
     * smooth transition a record can have temporarily many local
     * ids.
     *
     * @type {string[]}
     */
    localIds = [];
    get objectId() {
        return this.localId;
    }
    /**
     * List of object ids of the record.
     * Object ids include local ids, and also all currently known way
     * to identify this record. An object id is a stringified version
     * of data that identify the record. A non-local object id matches
     * an AND expression in static id.
     *
     * @type {string[]}
     */
    objectIds = [];
    /** @type {this} */
    _0; // previously "_raw"
    /** @type {this} */
    _1; // previously "_proxyInternal"
    /** @type {this} */
    _2; // previously "_proxy"

    constructor() {
        this.setup();
    }

    setup() {}

    update(data) {
        if (data === undefined) {
            return;
        }
        const this0 = _0(this);
        return this0._store0.MAKE_UPDATE(function R_update() {
            if (typeof data === "object" && data !== null) {
                this0._store0.updateFields(this0, data);
            } else {
                // update on single-id data
                if (Record.VERSION === 0) {
                    this0._store0.updateFields(this0, { [this0.Model.id]: data });
                } else {
                    const singleIds = this0.Model._id
                        .filter((item) => item.length === 1)
                        .map((item) => item[0]);
                    if (singleIds.length !== 1) {
                        throw new Error(`
                            Model "${this0.name}" has more than one single-id.
                            Shorthand to get/insert records with non-object is only supported with a single single-id.
                            Found singleIds: ${singleIds.map((item) => item[0]).join(",")}
                        `);
                    }
                    this0._store0.updateFields(this0, { [singleIds[0]]: data });
                }
            }
        });
    }

    delete() {
        const this0 = _0(this);
        return this0._store0.MAKE_UPDATE(function R_delete() {
            this0._store0.ADD_QUEUE(this0, "delete");
        });
    }

    /** @param {Record} record */
    eq(record) {
        const this0 = _0(this);
        const record0 = _0(record);
        if (!record?.localId) {
            return;
        }
        for (const thisLocalId of this0.localIds || []) {
            for (const recordLocalId of record0.localIds || []) {
                if (thisLocalId === recordLocalId) {
                    return true;
                }
            }
        }
        return false;
    }

    /** @param {Record} record */
    notEq(record) {
        return !this.eq(record);
    }

    /** @param {Record[]|RecordList} collection */
    in(collection) {
        if (!collection) {
            return false;
        }
        if (collection instanceof RecordList) {
            return collection.includes(this);
        }
        // Array
        return collection.some((record) => _0(record).eq(this));
    }

    /** @param {Record[]|RecordList} collection */
    notIn(collection) {
        return !this.in(collection);
    }

    toData() {
        const this0 = _0(this);
        const data = { ...this };
        for (const [name, { value }] of this0._fields) {
            if (isMany(value)) {
                data[name] = value.map((record2) => {
                    const record = _0(record2);
                    return record.toIdData.call(record._1);
                });
            } else if (isOne(value)) {
                const record = _0(value[0]);
                data[name] = record?.toIdData.call(record._1);
            } else {
                data[name] = this[name]; // attr()
            }
        }
        for (const key of Object.keys(this0.Model.INSTANCE_INTERNALS)) {
            delete data[key];
        }
        return data;
    }
    toIdData() {
        const data = this.Model._retrieveIdFromData(this);
        for (const [name, val] of Object.entries(data)) {
            if (isRecord(val)) {
                data[name] = val.toIdData();
            }
        }
        return data;
    }

    /**
     * The internal reactive is only necessary to trigger outer reactives when
     * writing on it. As it has no callback, reading through it has no effect,
     * except slowing down performance and complexifying the stack.
     */
    _downgradeProxy(this3) {
        return this._2 === this3 ? this._1 : this3;
    }
}

Record.register();
