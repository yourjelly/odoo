/* @odoo-module */

import { markRaw, toRaw } from "@odoo/owl";
import { RecordList } from "./record_list";
import { RecordUses } from "./record_uses";
import {
    ATTR_SYM,
    MANY_SYM,
    ONE_SYM,
    OR_SYM,
    modelRegistry,
    _0,
    isCommand,
    isMany,
    isOne,
    isRecord,
    isRelation,
} from "./misc";

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

export class Record {
    static id;
    /** @type {Object<string, Record>} */
    static records;
    /** @type {import("models").Store} */
    static store;
    /** @type {import("models").Store} */
    static store0;
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
        const Model = toRaw(this);
        return this.records[Model.localId(data)];
    }
    static register() {
        modelRegistry.add(this.name, this);
    }
    static localId(data) {
        const Model = toRaw(this);
        let idStr;
        if (typeof data === "object" && data !== null) {
            idStr = Model._localId(Model.id, data);
        } else {
            idStr = data; // non-object data => single id
        }
        return `${Model.name},${idStr}`;
    }
    static _localId(expr, data, { brackets = false } = {}) {
        const Model = toRaw(this);
        if (!Array.isArray(expr)) {
            const definition = Model._fields.get(expr);
            if (definition) {
                if (isMany(definition)) {
                    throw new Error("Using a Record.many() as id is not (yet) supported");
                }
                if (!isRelation(definition)) {
                    return data[expr];
                }
                if (isCommand(data[expr])) {
                    // Note: only one() is supported
                    const [cmd, data2] = data[expr].at(-1);
                    if (cmd === "DELETE") {
                        return undefined;
                    } else {
                        return `(${data2?.localId})`;
                    }
                }
                // relational field (note: optional when OR)
                return `(${data[expr]?.localId})`;
            }
            return data[expr];
        }
        const vals = [];
        for (let i = 1; i < expr.length; i++) {
            vals.push(Model._localId(expr[i], data, { brackets: true }));
        }
        let res = vals.join(expr[0] === OR_SYM ? " OR " : " AND ");
        if (brackets) {
            res = `(${res})`;
        }
        return res;
    }
    static _retrieveIdFromData(data) {
        const Model = toRaw(this);
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
        if (Model.id === undefined) {
            return res;
        }
        if (typeof Model.id === "string") {
            if (typeof data !== "object" || data === null) {
                return { [Model.id]: data }; // non-object data => single id
            }
            if (isCommand(data[Model.id])) {
                // Note: only one() is supported
                const [cmd, data2] = data[Model.id].at(-1);
                return Object.assign(res, {
                    [Model.id]:
                        cmd === "DELETE"
                            ? undefined
                            : cmd === "DELETE.noinv"
                            ? [["DELETE.noinv", data2]]
                            : cmd === "ADD.noinv"
                            ? [["ADD.noinv", data2]]
                            : data2,
                });
            }
            return { [Model.id]: data[Model.id] };
        }
        for (const expr of Model.id) {
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
        const Model = toRaw(this);
        return Model.store0.MAKE_UPDATE(function R_new() {
            const rec1 = new Model.Class();
            const rec0 = _0(rec1);
            const ids = Model._retrieveIdFromData(data);
            for (const name in ids) {
                if (
                    ids[name] &&
                    !isRecord(ids[name]) &&
                    !isCommand(ids[name]) &&
                    isRelation(Model._fields.get(name))
                ) {
                    // preinsert that record in relational field,
                    // as it is required to make current local id
                    ids[name] = Model.store0[Model._fields.get(name).targetModel].preinsert(
                        ids[name]
                    );
                }
            }
            Object.assign(rec0, { localId: Model.localId(ids) });
            Object.assign(rec1, { ...ids });
            Model.records[rec0.localId] = rec1;
            if (rec0.Model.name === "Store") {
                Object.assign(rec0, {
                    env: Model.store0.env,
                    recordByLocalId: Model.store0.recordByLocalId,
                });
            }
            Model.store0.recordByLocalId.set(rec0.localId, rec1);
            for (const field of rec0._fields.values()) {
                field.requestCompute?.();
                field.requestSort?.();
            }
            return rec1;
        });
    }
    /**
     * @template {keyof import("models").Models} M
     * @param {M} targetModel
     * @param {Object} [param1={}]
     * @param {Function} [param1.compute] if set, the value of this relational field is declarative and
     *   is computed automatically. All reactive accesses recalls that function. The context of
     *   the function is the record. Returned value is new value assigned to this field.
     * * @property {boolean} [eager=false] when field is computed, determines whether the computation
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
    static one(targetModel, { compute, eager = false, inverse, onAdd, onDelete, onUpdate } = {}) {
        return [ONE_SYM, { targetModel, compute, eager, inverse, onAdd, onDelete, onUpdate }];
    }
    /**
     * @template {keyof import("models").Models} M
     * @param {M} targetModel
     * @param {Object} [param1={}]
     * @param {Function} [param1.compute] if set, the value of this relational field is declarative and
     *   is computed automatically. All reactive accesses recalls that function. The context of
     *   the function is the record. Returned value is new value assigned to this field.
     * @property {boolean} [eager=false] when field is computed, determines whether the computation
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
     * @property {(r1: import("models").Models[M], r2: import("models").Models[M]) => number} [sort] if defined, this field
     *   is automatically sorted by this function.
     * @returns {import("models").Models[M][]}
     */
    static many(
        targetModel,
        { compute, eager = false, inverse, onAdd, onDelete, onUpdate, sort } = {}
    ) {
        return [
            MANY_SYM,
            { targetModel, compute, eager, inverse, onAdd, onDelete, onUpdate, sort },
        ];
    }
    /**
     * @template T
     * @param {T} def
     * @param {Object} [param1={}]
     * @param {Function} [param1.compute] if set, the value of this attr field is declarative and
     *   is computed automatically. All reactive accesses recalls that function. The context of
     *   the function is the record. Returned value is new value assigned to this field.
     * @property {boolean} [eager=false] when field is computed, determines whether the computation
     *   of this field is eager or lazy. By default, fields are computed lazily, which means that
     *   they are computed when dependencies change AND when this field is being used. In eager mode,
     *   the field is immediately (re-)computed when dependencies changes, which matches the built-in
     *   behaviour of OWL reactive.
     * @param {boolean} [param1.html] if set, the field value contains html value.
     *   Useful to automatically markup when the insert is trusted.
     * @param {() => void} [param1.onUpdate] function that is called when the field value is updated.
     *   This is called at least once at record creation.
     * @property {(Object, Object) => number} [sort] if defined, this field is automatically sorted
     *   by this function.
     * @returns {T}
     */
    static attr(def, { compute, eager = false, html, onUpdate, sort } = {}) {
        return [ATTR_SYM, { compute: compute, default: def, eager, html, onUpdate, sort }];
    }
    /** @returns {Record|Record[]} */
    static insert(data, options = {}) {
        const Model3 = this;
        const Model = toRaw(Model3);
        const store0 = Model.store0;
        return store0.MAKE_UPDATE(function R_insert() {
            const isMulti = Array.isArray(data);
            if (!isMulti) {
                data = [data];
            }
            const oldTrusted = store0.trusted;
            store0.trusted = options.html ?? store0.trusted;
            const res = data.map(function R_insert_map(d) {
                return Model._insert.call(Model3, d, options);
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
        const Model3 = this;
        const Model = toRaw(Model3);
        const record3 = Model.preinsert.call(Model3, data);
        const record = _0(record3);
        record.update.call(record._2, data);
        return record3;
    }
    /**
     * @param {Object} data
     * @returns {Record}
     */
    static preinsert(data) {
        const Model3 = this;
        const Model = toRaw(Model3);
        return Model.get.call(Model3, data) ?? Model.new(data);
    }

    /**
     * Raw relational values of the record, each of which contains object id(s)
     * rather than the record(s). This allows data in store and models being normalized,
     * which eases handling relations notably in when a record gets deleted.
     *
     * @type {Map<string, RecordField>}
     */
    _fields = new Map();
    /** @type {Set<string>} */
    _proxyUsed;
    /** @type {Set<string>} */
    _updateFields;
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
    /** @type {string} */
    localId;
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
        const this0 = _0(this);
        return this0._store0.MAKE_UPDATE(function R_update() {
            if (typeof data === "object" && data !== null) {
                this0._store0.updateFields(this0, data);
            } else {
                // update on single-id data
                this0._store0.updateFields(this0, { [this0.Model.id]: data });
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
        return _0(this) === _0(record);
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
        delete data._fields;
        delete data._2;
        delete data._1;
        delete data._proxyUsed;
        delete data._0;
        delete data.Model;
        delete data._updateFields;
        delete data.__uses__;
        delete data.Model;
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
