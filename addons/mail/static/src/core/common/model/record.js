/* @odoo-module */

import { markRaw, reactive } from "@odoo/owl";
import { RecordList } from "./record_list";
import { RecordUses } from "./record_uses";
import {
    ATTR_SYM,
    MANY_SYM,
    ONE_SYM,
    modelRegistry,
    _0,
    isCommand,
    isRecord,
    isRelation,
    VERSION,
    FIELD_DEFINITION_SYM,
} from "./misc";
import { DeprecatedRecord } from "./deprecated_record";
import { onChange } from "@mail/utils/common/misc";

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
                if (!store0.RO_QUEUE.has(fn)) {
                    store0.RO_QUEUE.set(fn, true);
                }
            } else {
                fn();
            }
        });
    }
    /** @type {Map<string, boolean>} */
    static fields;
    /** @type {Map<string, any>} */
    static fieldsDefault;
    /** @type {Map<string, boolean>} */
    static fieldsAttr;
    /** @type {Map<string, boolean>} */
    static fieldsOne;
    /** @type {Map<string, boolean>} */
    static fieldsMany;
    /** @type {Map<string, boolean>} */
    static fieldsHtml;
    /** @type {Map<string, string>} */
    static fieldsTargetModel;
    /** @type {Map<string, () => any>} */
    static fieldsCompute;
    /** @type {Map<string, boolean>} */
    static fieldsEager;
    /** @type {Map<string, string>} */
    static fieldsInverse;
    /** @type {Map<string, () => void>} */
    static fieldsOnAdd;
    /** @type {Map<string, () => void>} */
    static fieldsOnDelete;
    /** @type {Map<string, () => void>} */
    static fieldsOnUpdate;
    /** @type {Map<string, () => number>} */
    static fieldsSort;
    /** @type {Map<string, number>} */
    static fieldsNextTs;
    static makeFieldMaps() {
        return {
            fields: markRaw(new Map()),
            fieldsAttr: markRaw(new Map()),
            fieldsOne: markRaw(new Map()),
            fieldsMany: markRaw(new Map()),
            fieldsHtml: markRaw(new Map()),
            fieldsDefault: markRaw(new Map()),
            fieldsTargetModel: markRaw(new Map()),
            fieldsCompute: markRaw(new Map()),
            fieldsEager: markRaw(new Map()),
            fieldsInverse: markRaw(new Map()),
            fieldsOnAdd: markRaw(new Map()),
            fieldsOnDelete: markRaw(new Map()),
            fieldsOnUpdate: markRaw(new Map()),
            fieldsSort: markRaw(new Map()),
            fieldsNextTs: markRaw(new Map()),
        };
    }
    static prepareField(fieldName, data) {
        this.fields.set(fieldName, true);
        if (data[ATTR_SYM]) {
            this.fieldsAttr.set(fieldName, data[ATTR_SYM]);
        }
        if (data[ONE_SYM]) {
            this.fieldsOne.set(fieldName, data[ONE_SYM]);
        }
        if (data[MANY_SYM]) {
            this.fieldsMany.set(fieldName, data[MANY_SYM]);
        }
        for (const key in data) {
            const value = data[key];
            switch (key) {
                case "html": {
                    if (!value) {
                        break;
                    }
                    this.fieldsHtml.set(fieldName, value);
                    break;
                }
                case "default": {
                    if (value === undefined) {
                        break;
                    }
                    this.fieldsDefault.set(fieldName, value);
                    break;
                }
                case "targetModel": {
                    this.fieldsTargetModel.set(fieldName, value);
                    break;
                }
                case "compute": {
                    this.fieldsCompute.set(fieldName, value);
                    break;
                }
                case "eager": {
                    if (!value) {
                        break;
                    }
                    this.fieldsEager.set(fieldName, value);
                    break;
                }
                case "sort": {
                    this.fieldsSort.set(fieldName, value);
                    break;
                }
                case "inverse": {
                    this.fieldsInverse.set(fieldName, value);
                    break;
                }
                case "onAdd": {
                    this.fieldsOnAdd.set(fieldName, value);
                    break;
                }
                case "onDelete": {
                    this.fieldsOnDelete.set(fieldName, value);
                    break;
                }
                case "onUpdate": {
                    this.fieldsOnUpdate.set(fieldName, value);
                    break;
                }
            }
        }
        this.fieldsNextTs.set(fieldName, 0);
    }
    static isRecord(record) {
        return isRecord(record);
    }
    static get(data) {
        const this0 = _0(this);
        return this.records[this0.dataToLocalId(data)];
    }
    static get singleIds() {
        return this._id
            .filter((item) => Object.keys(item).length === 1)
            .map((item) => Object.keys(item)[0]);
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
            const singleIds = this0.singleIds;
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
            /** @type {Object<string, false | () => boolean>} */
            const expr = this0._id[i];
            if (
                Object.entries(expr).some(
                    ([fieldName, eligible]) => !(fieldName in data && (!eligible || eligible(data)))
                )
            ) {
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
            /** @type {Object<string, false | () => boolean>} */
            const expr = this0._id[i];
            if (
                Object.entries(expr).some(
                    ([fieldName, eligible]) =>
                        record[fieldName] === undefined && (!eligible || eligible(record._1))
                )
            ) {
                continue;
            }
            this._retrieveObjectIdsFromExpr(expr, record._1, {
                onObjectId: (objectId) => {
                    objectIds.push(objectId);
                },
            });
        }
        return objectIds;
    }
    /**
     * @param {Object<string, false | () => boolean>} expr part of an AND expression in model ids. See static _id
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
        const fields = Object.entries(expr).map(([fieldName, eligibility]) => ({
            name: fieldName,
            relation: isRelation(this0, fieldName),
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
                    const targetModel = this0.fieldsTargetModel.get(name);
                    return this0.store0[targetModel].get(param2);
                } else if ([null, false, undefined].includes(data[name])) {
                    return undefined;
                } else {
                    const targetModel = this0.fieldsTargetModel.get(name);
                    return this0.store0[targetModel].get(data[name]);
                }
            };
            if (index >= fields.length) {
                let ok = true;
                const fieldVals = Object.entries(expr)
                    .map(([fieldName, eligible]) => {
                        if (typeof eligible === "function" && !eligible(data)) {
                            ok = false;
                            return;
                        }
                        if (isRelation(this0, fieldName)) {
                            const i = fcounts2[fieldToIndex[fieldName]];
                            const relatedRecord = getRelatedRecord(fieldName);
                            if (!relatedRecord) {
                                ok = false;
                                return;
                            }
                            return `${fieldName}: (${relatedRecord.localIds[i]})`;
                        } else {
                            return `${fieldName}: ${data[fieldName]}`;
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
            for (const fieldName of rec0.Model.fields.keys()) {
                rec0.requestComputeField(fieldName);
                rec0.requestSortField(fieldName);
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
        // Most recent values have precedence over old conflicting ones
        for (const fieldName of this0.fields.keys()) {
            const aTs = a.fieldsTs.get(fieldName);
            const bTs = b.fieldsTs.get(fieldName);
            let resVal;
            if (aTs && !bTs) {
                resVal = a._fields.get(fieldName);
                b._customAssignThroughProxy = () => {
                    b._fields.set(fieldName, resVal);
                };
            } else if (!aTs && bTs) {
                // use b
                resVal = b._fields.get(fieldName);
                a._customAssignThroughProxy = () => {
                    a._fields.set(fieldName, resVal);
                };
            } else if (!aTs && !bTs) {
                // none have been converted to record field... nothing to do!
            } else if (aTs > bTs) {
                // use a
                resVal = a._fields.get(fieldName);
                b._customAssignThroughProxy = () => {
                    b._fields.set(fieldName, resVal);
                };
            } else {
                // use b
                resVal = b._fields.get(fieldName);
                a._customAssignThroughProxy = () => {
                    a._fields.set(fieldName, resVal);
                };
            }
            /** @type {RecordList} */
            let a2Reclist;
            /** @type {RecordList} */
            let b2Reclist;
            if (isRelation(this0, fieldName)) {
                /** @type {RecordList} */
                const aReclist = a._fields.get(fieldName);
                /** @type {RecordList} */
                const bReclist = b._fields.get(fieldName);
                a2Reclist = aReclist._2;
                b2Reclist = bReclist._2;
                /** @type {RecordList} */
                const reclist = resVal;
                aReclist._0 = reclist._0;
                aReclist._1 = reclist._1;
                aReclist._2 = reclist._2;
                aReclist._0 = reclist._0;
                aReclist._1 = reclist._1;
                aReclist._2 = reclist._2;
                const inverse = this0.fieldsInverse.get(fieldName);
                if (inverse) {
                    const removedRecs = [];
                    for (const localId of [...aReclist.state.data, ...bReclist.state.data]) {
                        let otherRec = _0(_0(store0.localIdToRecord).get(localId));
                        for (let i = 0; otherRec && i < otherRec.localIds.length; i++) {
                            const localId = otherRec.localIds[i];
                            if (reclist.state.data.some((d) => d === localId)) {
                                otherRec = false;
                            }
                        }
                        if (otherRec && !removedRecs.some((rec) => rec.eq(otherRec))) {
                            removedRecs.push(otherRec);
                        }
                    }
                    for (const removedRec of removedRecs) {
                        const otherReclist = removedRec._fields.get(inverse);
                        const owner = reclist.owner;
                        for (const localId of owner.localIds) {
                            otherReclist.state.data = otherReclist.state.data.filter(
                                (d) => d !== localId
                            );
                            store0.ADD_QUEUE(
                                "onDelete",
                                otherReclist.owner,
                                otherReclist.name,
                                owner
                            );
                            store0.ADD_QUEUE("onDelete", reclist.owner, reclist.name, removedRec);
                        }
                    }
                }
            }
            if (a._customAssignThroughProxy) {
                a._2[fieldName] = resVal;
            }
            if (b._customAssignThroughProxy) {
                b._2[fieldName] = resVal;
            }
            if (a2Reclist) {
                a2Reclist.state = resVal.state;
            }
            if (b2Reclist) {
                b2Reclist.state = resVal.state;
            }
        }
        // TODO combine the uses
        // the tracked uses are for efficient deletion of self,
        // so it's fine if we overestimate it a bit
        const data = a.__uses__.data;
        for (const [localId, bFields] of b.__uses__.data.entries()) {
            const aFields = data.get(localId);
            if (!aFields) {
                data.set(localId, bFields);
            } else {
                for (const [name, bCount] of bFields.entries()) {
                    const aCount = aFields.get(name);
                    if (aCount === undefined) {
                        aFields.set(name, bCount);
                    } else {
                        aFields.set(name, aCount + bCount);
                    }
                }
            }
        }
        b.__uses__.data = data;
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
        return { ...param1, targetModel, [FIELD_DEFINITION_SYM]: true, [ONE_SYM]: true };
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
        return { ...param1, targetModel, [FIELD_DEFINITION_SYM]: true, [MANY_SYM]: true };
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
        return { ...param1, [FIELD_DEFINITION_SYM]: true, [ATTR_SYM]: true, default: def };
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
    static get INSTANCE_INTERNALS() {
        return {
            fieldsComputing: true,
            fieldsSortOnNeed: true,
            fieldsSortInNeed: true,
            fieldsSorting: true,
            fieldsComputeInNeed: true,
            fieldsComputeOnNeed: true,
            fieldsOnUpdateObserves: true,
            fieldsSortProxy2: true,
            fieldsComputeProxy2: true,
            fieldsTs: true,
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
            trusted: true,
            UPDATE: true,
            FC_QUEUE: true,
            FS_QUEUE: true,
            FA_QUEUE: true,
            FD_QUEUE: true,
            FU_QUEUE: true,
            RO_QUEUE: true,
            RD_QUEUE: true,
        };
    }
    // Note: state of fields in Maps rather than object is intentional for improved performance.
    /**
     * For computed field, determines whether the field is computing its value.
     *
     * @type {Map<string, boolean>}
     */
    fieldsComputing = markRaw(new Map());
    /**
     * On lazy-sorted field, determines whether the field should be (re-)sorted
     * when it's needed (i.e. accessed). Eager sorted fields are immediately re-sorted at end of update cycle,
     * whereas lazy sorted fields wait extra for them being needed.
     *
     * @type {Map<string, boolean>}
     */
    fieldsSortOnNeed = markRaw(new Map());
    /**
     * On lazy sorted-fields, determines whether this field is needed (i.e. accessed).
     *
     * @type {Map<string, boolean>}
     */
    fieldsSortInNeed = markRaw(new Map());
    /**
     * For sorted field, determines whether the field is sorting its value.
     *
     * @type {Map<string, boolean>}
     */
    fieldsSorting = markRaw(new Map());
    /**
     * On lazy computed-fields, determines whether this field is needed (i.e. accessed).
     *
     * @type {Map<string, boolean>}
     */
    fieldsComputeInNeed = markRaw(new Map());
    /**
     * on lazy-computed field, determines whether the field should be (re-)computed
     * when it's needed (i.e. accessed). Eager computed fields are immediately re-computed at end of update cycle,
     * whereas lazy computed fields wait extra for them being needed.
     *
     * @type {Map<string, boolean>}
     */
    fieldsComputeOnNeed = markRaw(new Map());
    /** @type {Map<string, () => void>} */
    fieldsOnUpdateObserves = markRaw(new Map());
    /** @type {Map<string, this>} */
    fieldsSortProxy2 = markRaw(new Map());
    /** @type {Map<string, this>} */
    fieldsComputeProxy2 = markRaw(new Map());
    /** @type {Map<string, number>} */
    fieldsTs = markRaw(new Map());

    _reconciling = false;
    /** @type {() => void>} */
    _customAssignThroughProxy;
    /** @type {boolean} */
    _redirectedRecord;
    /** @type {Map<string, import("./record_list").RecordList|any>}*/
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
                    const singleIds = this0.Model.singleIds;
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
            this0._store0.ADD_QUEUE("delete", this0);
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
        for (const [name, value] of this0._fields) {
            if (this0.Model.fieldsMany.get(name)) {
                data[name] = value.map((record2) => {
                    const record = _0(record2);
                    return record.toIdData.call(record._1);
                });
            } else if (this0.Model.fieldsOne.get(name)) {
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

    /**
     * For computed field, invoking this function (re-)computes the field.
     *
     * @type {string} fieldName
     */
    computeField(fieldName) {
        const compute = this.Model.fieldsCompute.get(fieldName);
        if (!compute) {
            return;
        }
        this.fieldsComputing.set(fieldName, true);
        this.fieldsComputeOnNeed.delete(fieldName, true);
        const proxy2 = this.fieldsComputeProxy2.get(fieldName);
        this._store0.MAKE_UPDATE(() => {
            this._store0.updateFields(this, { [fieldName]: compute.call(proxy2) });
        });
        this.fieldsComputing.delete(fieldName);
    }

    /**
     * For sorted field, invoking this function (re-)sorts the field.
     *
     * @type {string} fieldName
     */
    sortField(fieldName) {
        const sort = this.Model.fieldsSort.get(fieldName);
        if (!sort) {
            return;
        }
        this.fieldsSortOnNeed.delete(fieldName);
        this.fieldsSorting.set(fieldName, true);
        const proxy2 = this.fieldsSortProxy2.get(fieldName);
        this._store0.MAKE_UPDATE(() => {
            if (this.Model.fieldsAttr.get(fieldName)) {
                proxy2[fieldName].sort(sort);
            } else {
                this._store0.sortRecordList(proxy2._fields.get(fieldName)._2, sort.bind(proxy2));
            }
        });
        this.fieldsSorting.delete(fieldName);
    }

    /**
     * on computed field, calling this function makes a request to compute
     * the field. This doesn't necessarily mean the field is immediately re-computed: during an update cycle, this
     * is put in the compute FC_QUEUE and will be invoked at end.
     *
     * @param {string} fieldName
     * @param {Object} [param1={}]
     * @param {boolean} [param1.force=false]
     */
    requestComputeField(fieldName, { force = false } = {}) {
        const Model = this.Model;
        if (!Model.fieldsCompute.get(fieldName)) {
            return;
        }
        if (this._store0.UPDATE !== 0 && !force) {
            this._store0.ADD_QUEUE("compute", this, fieldName);
        } else {
            if (Model.fieldsEager.get(fieldName) || this.fieldsComputeInNeed.get(fieldName)) {
                this.computeField(fieldName);
            } else {
                this.fieldsComputeOnNeed.set(fieldName, true);
            }
        }
    }

    /**
     * on sorted field, calling this function makes a request to sort
     * the field. This doesn't necessarily mean the field is immediately re-sorted: during an update cycle, this
     * is put in the sort FS_QUEUE and will be invoked at end.
     *
     * @param {string} fieldName
     * @param {Object} [param1={}]
     * @param {boolean} [param1.force=false]
     */
    requestSortField(fieldName, { force } = {}) {
        const Model = this.Model;
        if (!Model.fieldsSort.get(fieldName)) {
            return;
        }
        if (this._store0.UPDATE !== 0 && !force) {
            this._store0.ADD_QUEUE("sort", this, fieldName);
        } else {
            if (Model.fieldsEager.get(fieldName) || this.fieldsSortInNeed.get(fieldName)) {
                this.sortField(fieldName);
            } else {
                this.fieldsSortOnNeed.set(fieldName, true);
            }
        }
    }

    prepareFieldOnRecomputeObjectIds(fieldName) {
        const this0 = this;
        const this2 = this0._2;
        const Model = this0.Model;
        if (Model.fieldsAttr.get(fieldName)) {
            onChange(this2, fieldName, function RF_onChangeRecomputeObjectIds_attr() {
                Model.onRecomputeObjectIds(this0._1);
            });
        } else {
            onChange(
                this2._fields.get(fieldName).state,
                "data",
                function RF_onChangeRecomputeObjectIds_rel_data() {
                    Model.onRecomputeObjectIds(this0._1);
                }
            );
            onChange(
                this2._fields.get(fieldName).state.data,
                "length",
                function RF_onChangeRecomputeObjectIds_rel_data_length() {
                    Model.onRecomputeObjectIds(this0._1);
                }
            );
        }
    }

    prepareField(fieldName) {
        const this0 = _0(this);
        const this2 = this0._2;
        const Model = this0.Model;
        if (isRelation(Model, fieldName)) {
            const reclist0 = new RecordList({
                owner: this0,
                name: fieldName,
                store: this0._store0,
            });
            reclist0._0 = reclist0;
            this0._fields.set(fieldName, reclist0);
        }
        if (this0.Model.objectIdFields[fieldName]) {
            this0.prepareFieldOnRecomputeObjectIds(fieldName);
        }
        if (Model.fieldsAttr.get(fieldName)) {
            const defaultVal = Model.fieldsDefault.get(fieldName);
            if (defaultVal !== undefined) {
                this2._fields.set(fieldName, defaultVal);
            }
        }
        const nextTs = Model.fieldsNextTs.get(fieldName);
        this.fieldsTs.set(fieldName, nextTs);
        Model.fieldsNextTs.set(fieldName, nextTs + 1);
        if (Model.fieldsCompute.get(fieldName)) {
            if (!Model.fieldsEager.get(fieldName)) {
                onChange(this2, fieldName, () => {
                    if (this0.fieldsComputing.get(fieldName)) {
                        /**
                         * Use a reactive to reset the computeInNeed flag when there is
                         * a change. This assumes when other reactive are still
                         * observing the value, its own callback will reset the flag to
                         * true through the proxy getters.
                         */
                        this0.fieldsComputeInNeed.delete(fieldName);
                    }
                });
                // reset flags triggered by registering onChange
                this0.fieldsComputeInNeed.delete(fieldName);
                this0.fieldsSortInNeed.delete(fieldName);
            }
            const proxy2 = reactive(this2, function RF_computeObserver() {
                this0.requestComputeField(fieldName);
            });
            this0.fieldsComputeProxy2.set(fieldName, proxy2);
        }
        if (Model.fieldsSort.get(fieldName)) {
            if (!Model.fieldsEager.get(fieldName)) {
                onChange(this2, fieldName, () => {
                    if (this0.fieldsSorting.get(fieldName)) {
                        /**
                         * Use a reactive to reset the inNeed flag when there is a
                         * change. This assumes if another reactive is still observing
                         * the value, its own callback will reset the flag to true
                         * through the proxy getters.
                         */
                        this0.fieldsSortInNeed.delete(fieldName);
                    }
                });
                // reset flags triggered by registering onChange
                this0.fieldsComputeInNeed.delete(fieldName);
                this0.fieldsSortInNeed.delete(fieldName);
            }
            const proxy2 = reactive(this2, function RF_sortObserver() {
                this0.requestSortField(fieldName);
            });
            this0.fieldsSortProxy2.set(fieldName, proxy2);
        }
        if (Model.fieldsOnUpdate.get(fieldName)) {
            this0._store0._onChange(this2, fieldName, (obs) => {
                this0.fieldsOnUpdateObserves.set(fieldName, obs);
                if (this0._store0.UPDATE !== 0) {
                    this0._store0.ADD_QUEUE("onUpdate", this0, fieldName);
                } else {
                    this0.onUpdateField(fieldName);
                }
            });
        }
    }

    /**
     * Function that contains functions to be called when the value of field has changed, e.g. sort and onUpdate.
     *
     * @param {string} fieldName
     */
    onUpdateField(fieldName) {
        const onUpdate = this.Model.fieldsOnUpdate.get(fieldName);
        if (!onUpdate) {
            return;
        }
        this._store0.MAKE_UPDATE(() => {
            /**
             * Forward internal proxy for performance as onUpdate does not
             * need reactive (observe is called separately).
             */
            onUpdate.call(this._1);
            this.fieldsOnUpdateObserves.get(fieldName)?.();
        });
    }
}

Record.register();
