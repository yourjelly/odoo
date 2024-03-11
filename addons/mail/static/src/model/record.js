export class Record {
    /** @param {FieldDefinition} */
    static isAttr(definition) {
        return Boolean(definition?.[ATTR_SYM]);
    }
    /**
     * Determines whether the inserts are considered trusted or not.
     * Useful to auto-markup html fields when this is set
     */
    static trusted = false;
    static id;
    /** @type {Object<string, Record>} */
    static records;
    /** @type {import("models").Store} */
    static store;
    /** @type {RecordField[]} */
    static FC_QUEUE = []; // field-computes
    /** @type {RecordField[]} */
    static FS_QUEUE = []; // field-sorts
    /** @type {Array<{field: RecordField, records: Record[]}>} */
    static FA_QUEUE = []; // field-onadds
    /** @type {Array<{field: RecordField, records: Record[]}>} */
    static FD_QUEUE = []; // field-ondeletes
    /** @type {RecordField[]} */
    static FU_QUEUE = []; // field-onupdates
    /** @type {Function[]} */
    static RO_QUEUE = []; // record-onchanges
    /** @type {Record[]} */
    static RD_QUEUE = []; // record-deletes
    static RHD_QUEUE = []; // record-hard-deletes
    static UPDATE = 0;
    /** @param {() => any} fn */
    static MAKE_UPDATE(fn) {
        Record.UPDATE++;
        const res = fn();
        Record.UPDATE--;
        if (Record.UPDATE === 0) {
            // pretend an increased update cycle so that nothing in queue creates many small update cycles
            Record.UPDATE++;
            while (
                Record.FC_QUEUE.length > 0 ||
                Record.FS_QUEUE.length > 0 ||
                Record.FA_QUEUE.length > 0 ||
                Record.FD_QUEUE.length > 0 ||
                Record.FU_QUEUE.length > 0 ||
                Record.RO_QUEUE.length > 0 ||
                Record.RD_QUEUE.length > 0 ||
                Record.RHD_QUEUE.length > 0
            ) {
                const FC_QUEUE = [...Record.FC_QUEUE];
                const FS_QUEUE = [...Record.FS_QUEUE];
                const FA_QUEUE = [...Record.FA_QUEUE];
                const FD_QUEUE = [...Record.FD_QUEUE];
                const FU_QUEUE = [...Record.FU_QUEUE];
                const RO_QUEUE = [...Record.RO_QUEUE];
                const RD_QUEUE = [...Record.RD_QUEUE];
                const RHD_QUEUE = [...Record.RHD_QUEUE];
                Record.FC_QUEUE.length = 0;
                Record.FS_QUEUE.length = 0;
                Record.FA_QUEUE.length = 0;
                Record.FD_QUEUE.length = 0;
                Record.FU_QUEUE.length = 0;
                Record.RO_QUEUE.length = 0;
                Record.RD_QUEUE.length = 0;
                Record.RHD_QUEUE.length = 0;
                while (FC_QUEUE.length > 0) {
                    const field = FC_QUEUE.pop();
                    field.requestCompute({ force: true });
                }
                while (FS_QUEUE.length > 0) {
                    const field = FS_QUEUE.pop();
                    field.requestSort({ force: true });
                }
                while (FA_QUEUE.length > 0) {
                    const { field, records } = FA_QUEUE.pop();
                    const { onAdd } = field.value.fieldDefinition;
                    records.forEach((record) =>
                        onAdd?.call(field.value.owner._proxy, record._proxy)
                    );
                }
                while (FD_QUEUE.length > 0) {
                    const { field, records } = FD_QUEUE.pop();
                    const { onDelete } = field.value.fieldDefinition;
                    records.forEach((record) =>
                        onDelete?.call(field.value.owner._proxy, record._proxy)
                    );
                }
                while (FU_QUEUE.length > 0) {
                    const field = FU_QUEUE.pop();
                    field.onUpdate();
                }
                while (RO_QUEUE.length > 0) {
                    const cb = RO_QUEUE.pop();
                    cb();
                }
                while (RD_QUEUE.length > 0) {
                    const record = RD_QUEUE.pop();
                    for (const name of record._fields.keys()) {
                        record[name] = undefined;
                    }
                    for (const [localId, names] of record.__uses__.data.entries()) {
                        for (const [name2, count] of names.entries()) {
                            const usingRecordProxy = toRaw(
                                record.Model._rawStore.recordByLocalId
                            ).get(localId);
                            if (!usingRecordProxy) {
                                // record already deleted, clean inverses
                                record.__uses__.data.delete(localId);
                                continue;
                            }
                            const usingRecordList =
                                toRaw(usingRecordProxy)._raw._fields.get(name2).value;
                            if (RecordList.isMany(usingRecordList)) {
                                for (let c = 0; c < count; c++) {
                                    usingRecordProxy[name2].delete(record);
                                }
                            } else {
                                usingRecordProxy[name2] = undefined;
                            }
                        }
                    }
                    this.ADD_QUEUE(record, "hard_delete");
                }
                while (RHD_QUEUE.length > 0) {
                    const record = RHD_QUEUE.pop();
                    record[IS_DELETED_SYM] = true;
                    delete record.Model.records[record.localId];
                    record.Model._rawStore.recordByLocalId.delete(record.localId);
                }
            }
            Record.UPDATE--;
        }
        return res;
    }
    /**
     * @param {RecordField|Record} fieldOrRecord
     * @param {"compute"|"sort"|"onAdd"|"onDelete"|"onUpdate"} type
     * @param {Record} [record] when field with onAdd/onDelete, the record being added or deleted
     */
    static ADD_QUEUE(fieldOrRecord, type, record) {
        if (Record.isRecord(fieldOrRecord)) {
            /** @type {Record} */
            const record = fieldOrRecord;
            if (type === "delete") {
                if (!Record.RD_QUEUE.includes(record)) {
                    Record.RD_QUEUE.push(record);
                }
            }
            if (type === "hard_delete") {
                if (!Record.RHD_QUEUE.includes(record)) {
                    Record.RHD_QUEUE.push(record);
                }
            }
        } else {
            /** @type {RecordField} */
            const field = fieldOrRecord;
            const rawField = toRaw(field);
            if (type === "compute") {
                if (!Record.FC_QUEUE.some((f) => toRaw(f) === rawField)) {
                    Record.FC_QUEUE.push(field);
                }
            }
            if (type === "sort") {
                if (!rawField.value?.fieldDefinition.sort) {
                    return;
                }
                if (!Record.FS_QUEUE.some((f) => toRaw(f) === rawField)) {
                    Record.FS_QUEUE.push(field);
                }
            }
            if (type === "onAdd") {
                if (rawField.value?.fieldDefinition.sort) {
                    Record.ADD_QUEUE(fieldOrRecord, "sort");
                }
                if (!rawField.value?.fieldDefinition.onAdd) {
                    return;
                }
                const item = Record.FA_QUEUE.find((item) => toRaw(item.field) === rawField);
                if (!item) {
                    Record.FA_QUEUE.push({ field, records: [record] });
                } else {
                    if (!item.records.some((recordProxy) => recordProxy.eq(record))) {
                        item.records.push(record);
                    }
                }
            }
            if (type === "onDelete") {
                if (!rawField.value?.fieldDefinition.onDelete) {
                    return;
                }
                const item = Record.FD_QUEUE.find((item) => toRaw(item.field) === rawField);
                if (!item) {
                    Record.FD_QUEUE.push({ field, records: [record] });
                } else {
                    if (!item.records.some((recordProxy) => recordProxy.eq(record))) {
                        item.records.push(record);
                    }
                }
            }
            if (type === "onUpdate") {
                if (!Record.FU_QUEUE.some((f) => toRaw(f) === rawField)) {
                    Record.FU_QUEUE.push(field);
                }
            }
        }
    }
    static onChange(record, name, cb) {
        return Record._onChange(record, name, (observe) => {
            const fn = () => {
                observe();
                cb();
            };
            if (Record.UPDATE !== 0) {
                if (!Record.RO_QUEUE.some((f) => toRaw(f) === fn)) {
                    Record.RO_QUEUE.push(fn);
                }
            } else {
                fn();
            }
        });
    }
    /**
     * Version of onChange where the callback receives observe function as param.
     * This is useful when there's desire to postpone calling the callback function,
     * in which the observe is also intended to have its invocation postponed.
     *
     * @param {Record} record
     * @param {string|string[]} key
     * @param {(observe: Function) => any} callback
     * @returns {function} function to call to stop observing changes
     */
    static _onChange(record, key, callback) {
        let proxy;
        function _observe() {
            // access proxy[key] only once to avoid triggering reactive get() many times
            const val = proxy[key];
            if (typeof val === "object" && val !== null) {
                void Object.keys(val);
            }
            if (Array.isArray(val)) {
                void val.length;
                void toRaw(val).forEach.call(val, (i) => i);
            }
        }
        if (Array.isArray(key)) {
            for (const k of key) {
                Record._onChange(record, k, callback);
            }
            return;
        }
        let ready = true;
        proxy = reactive(record, () => {
            if (ready) {
                callback(_observe);
            }
        });
        _observe();
        return () => {
            ready = false;
        };
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
        return Boolean(record?.[IS_RECORD_SYM]);
    }
    /** @param {FIELD_SYM|RecordList} val */
    static isRelation(val) {
        if ([MANY_SYM, ONE_SYM].includes(val)) {
            return true;
        }
        return RecordList.isOne(val) || RecordList.isMany(val);
    }
    /** @param {FIELD_SYM} SYM */
    static isField(SYM) {
        return [MANY_SYM, ONE_SYM, ATTR_SYM].includes(SYM);
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
            const fieldDefinition = Model._fields.get(expr);
            if (fieldDefinition) {
                if (RecordList.isMany(fieldDefinition)) {
                    throw new Error("Using a Record.Many() as id is not (yet) supported");
                }
                if (!Record.isRelation(fieldDefinition)) {
                    return data[expr];
                }
                if (Record.isCommand(data[expr])) {
                    // Note: only Record.one() is supported
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
                if (Record.isCommand(data[expr2])) {
                    // Note: only Record.one() is supported
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
            if (Record.isCommand(data[Model.id])) {
                // Note: only Record.one() is supported
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
        return Record.MAKE_UPDATE(function RecordNew() {
            const recordProxy = new Model.Class();
            const record = toRaw(recordProxy)._raw;
            const ids = Model._retrieveIdFromData(data);
            for (const name in ids) {
                if (
                    ids[name] &&
                    !Record.isRecord(ids[name]) &&
                    !Record.isCommand(ids[name]) &&
                    Record.isRelation(Model._fields.get(name))
                ) {
                    // preinsert that record in relational field,
                    // as it is required to make current local id
                    ids[name] = Model._rawStore[Model._fields.get(name).targetModel].preinsert(
                        ids[name]
                    );
                }
            }
            Object.assign(record, { localId: Model.localId(ids) });
            Object.assign(recordProxy, { ...ids });
            Model.records[record.localId] = recordProxy;
            if (record.Model.name === "Store") {
                Object.assign(record, {
                    env: Model._rawStore.env,
                    recordByLocalId: Model._rawStore.recordByLocalId,
                });
            }
            Model._rawStore.recordByLocalId.set(record.localId, recordProxy);
            for (const field of record._fields.values()) {
                field.requestCompute?.();
                field.requestSort?.();
            }
            return recordProxy;
        });
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
     * @param {'datetime'|'date'} [param1.type] if defined, automatically transform to a
     * specific type.
     * @returns {T}
     */
    static attr(def, { compute, eager = false, html, onUpdate, sort, type } = {}) {
        return [ATTR_SYM, { compute, default: def, eager, html, onUpdate, sort, type }];
    }
    /** @returns {Record|Record[]} */
    static insert(data, options = {}) {
        const ModelFullProxy = this;
        const Model = toRaw(ModelFullProxy);
        return Record.MAKE_UPDATE(function RecordInsert() {
            const isMulti = Array.isArray(data);
            if (!isMulti) {
                data = [data];
            }
            const oldTrusted = Record.trusted;
            Record.trusted = options.html ?? Record.trusted;
            const res = data.map(function RecordInsertMap(d) {
                return Model._insert.call(ModelFullProxy, d, options);
            });
            Record.trusted = oldTrusted;
            if (!isMulti) {
                return res[0];
            }
            return res;
        });
    }
    /** @returns {Record} */
    static _insert(data) {
        const ModelFullProxy = this;
        const Model = toRaw(ModelFullProxy);
        const recordFullProxy = Model.preinsert.call(ModelFullProxy, data);
        const record = toRaw(recordFullProxy)._raw;
        record.update.call(record._proxy, data);
        return recordFullProxy;
    }
    /**
     * @returns {Record}
     */
    static preinsert(data) {
        const ModelFullProxy = this;
        const Model = toRaw(ModelFullProxy);
        return Model.get.call(ModelFullProxy, data) ?? Model.new(data);
    }
    static isCommand(data) {
        return ["ADD", "DELETE", "ADD.noinv", "DELETE.noinv"].includes(data?.[0]?.[0]);
    }

    /**
     * Raw relational values of the record, each of which contains object id(s)
     * rather than the record(s). This allows data in store and models being normalized,
     * which eases handling relations notably in when a record gets deleted.
     *
     * @type {Map<string, RecordField>}
     */
    _fields = new Map();
    __uses__ = markRaw(new RecordUses());
    /** @returns {import("models").Store} */
    get _store() {
        return toRaw(this)._raw.Model._rawStore._proxy;
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

    constructor() {
        this.setup();
    }

    setup() {}

    update(data) {
        const record = toRaw(this)._raw;
        return Record.MAKE_UPDATE(function recordUpdate() {
            if (typeof data === "object" && data !== null) {
                updateFields(record, data);
            } else {
                // update on single-id data
                updateFields(record, { [record.Model.id]: data });
            }
        });
    }

    delete() {
        const record = toRaw(this)._raw;
        return Record.MAKE_UPDATE(function recordDelete() {
            Record.ADD_QUEUE(record, "delete");
        });
    }

    exists() {
        return !this[IS_DELETED_SYM];
    }

    /** @param {Record} record */
    eq(record) {
        return toRaw(this)._raw === toRaw(record)?._raw;
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
        return collection.some((record) => toRaw(record)._raw.eq(this));
    }

    /** @param {Record[]|RecordList} collection */
    notIn(collection) {
        return !this.in(collection);
    }

    toData() {
        const recordProxy = this;
        const record = toRaw(recordProxy)._raw;
        const data = { ...recordProxy };
        for (const [name, { value }] of record._fields) {
            if (RecordList.isMany(value)) {
                data[name] = value.map((recordProxy) => {
                    const record = toRaw(recordProxy)._raw;
                    return record.toIdData.call(record._proxyInternal);
                });
            } else if (RecordList.isOne(value)) {
                const record = toRaw(value[0])?._raw;
                data[name] = record?.toIdData.call(record._proxyInternal);
            } else {
                data[name] = recordProxy[name]; // Record.attr()
            }
        }
        delete data._fields;
        delete data._proxy;
        delete data._proxyInternal;
        delete data._proxyUsed;
        delete data._raw;
        delete data.Model;
        delete data._updateFields;
        delete data.__uses__;
        delete data.Model;
        return data;
    }
    toIdData() {
        const data = this.Model._retrieveIdFromData(this);
        for (const [name, val] of Object.entries(data)) {
            if (Record.isRecord(val)) {
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
    _downgradeProxy(fullProxy) {
        return this._proxy === fullProxy ? this._proxyInternal : fullProxy;
    }
}

Record.register();