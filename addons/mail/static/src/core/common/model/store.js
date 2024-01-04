/* @odoo-module */

import { markup, reactive, toRaw } from "@odoo/owl";
import { Record } from "./record";
import { ATTR_SYM, Markup, STORE_SYM, _0, isAttr, isCommand, isMany, isRecord } from "./misc";
import { FieldDefinition } from "./field_definition";
import { RecordField } from "./record_field";

export class Store extends Record {
    /** @type {Object<string, typeof Record>} */
    Models;
    static singleton = true;
    /** @type {Map<string, string>} */
    objectIdToLocalId;
    /** @type {Map<string, Record>} */
    localIdToRecord;
    [STORE_SYM] = true;
    /**
     * Determines whether the inserts are considered trusted or not.
     * Useful to auto-markup html fields when this is set
     */
    trusted = false;
    UPDATE = 0;
    /** @type {import("./record_field").RecordField[]} */
    FC_QUEUE = []; // field-computes
    /** @type {import("./record_field").RecordField[]} */
    FS_QUEUE = []; // field-sorts
    /** @type {Array<{field: import("./record_field").RecordField, records: Record[]}>} */
    FA_QUEUE = []; // field-onadds
    /** @type {Array<{field: import("./record_field").RecordField, records: Record[]}>} */
    FD_QUEUE = []; // field-ondeletes
    /** @type {import("./record_field").RecordField[]} */
    FU_QUEUE = []; // field-onupdates
    /** @type {Function[]} */
    RO_QUEUE = []; // record-onchanges
    /** @type {Record[]} */
    RD_QUEUE = []; // record-deletes
    /** @param {() => any} fn */
    MAKE_UPDATE(fn) {
        const this0 = _0(this);
        this0.UPDATE++;
        const res = fn();
        this0.UPDATE--;
        if (this0.UPDATE === 0) {
            // pretend an increased update cycle so that nothing in queue creates many small update cycles
            this0.UPDATE++;
            while (
                this0.FC_QUEUE.length > 0 ||
                this0.FS_QUEUE.length > 0 ||
                this0.FA_QUEUE.length > 0 ||
                this0.FD_QUEUE.length > 0 ||
                this0.FU_QUEUE.length > 0 ||
                this0.RO_QUEUE.length > 0 ||
                this0.RD_QUEUE.length > 0
            ) {
                const FC_QUEUE = [...this0.FC_QUEUE];
                const FS_QUEUE = [...this0.FS_QUEUE];
                const FA_QUEUE = [...this0.FA_QUEUE];
                const FD_QUEUE = [...this0.FD_QUEUE];
                const FU_QUEUE = [...this0.FU_QUEUE];
                const RO_QUEUE = [...this0.RO_QUEUE];
                const RD_QUEUE = [...this0.RD_QUEUE];
                this0.FC_QUEUE.length = 0;
                this0.FS_QUEUE.length = 0;
                this0.FA_QUEUE.length = 0;
                this0.FD_QUEUE.length = 0;
                this0.FU_QUEUE.length = 0;
                this0.RO_QUEUE.length = 0;
                this0.RD_QUEUE.length = 0;
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
                    const { onAdd } = field.value.definition;
                    records.forEach((record) => onAdd?.call(field.value.owner._2, record._2));
                }
                while (FD_QUEUE.length > 0) {
                    const { field, records } = FD_QUEUE.pop();
                    const { onDelete } = field.value.definition;
                    records.forEach((record) => onDelete?.call(field.value.owner._2, record._2));
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
                    // effectively delete the record
                    for (const name of record._fields.keys()) {
                        record[name] = undefined;
                    }
                    for (const [localId, names] of record.__uses__.data.entries()) {
                        for (const [name2, count] of names.entries()) {
                            const usingRecord2 = _0(this0.localIdToRecord).get(localId);
                            if (!usingRecord2) {
                                // record already deleted, clean inverses
                                record.__uses__.data.delete(localId);
                                continue;
                            }
                            const usingRecordList = _0(usingRecord2)._fields.get(name2).value;
                            if (isMany(usingRecordList)) {
                                for (let c = 0; c < count; c++) {
                                    usingRecord2[name2].delete(record);
                                }
                            } else {
                                usingRecord2[name2] = undefined;
                            }
                        }
                    }
                    for (const objectId of record.objectIds) {
                        this0.objectIdToLocalId.delete(objectId);
                    }
                    for (const localId of record.localIds) {
                        delete record.Model.records[localId];
                        this0.localIdToRecord.delete(localId);
                    }
                }
            }
            this0.UPDATE--;
        }
        return res;
    }
    /**
     * @param {import("./record_field").RecordField|Record} fieldOrRecord
     * @param {"compute"|"sort"|"onAdd"|"onDelete"|"onUpdate"} type
     * @param {Record} [record] when field with onAdd/onDelete, the record being added or deleted
     */
    ADD_QUEUE(fieldOrRecord, type, record) {
        const this0 = _0(this);
        if (isRecord(fieldOrRecord)) {
            /** @type {Record} */
            const record = fieldOrRecord;
            if (type === "delete") {
                if (!this0.RD_QUEUE.includes(record)) {
                    this0.RD_QUEUE.push(record);
                }
            }
        } else {
            /** @type {import("./record_field").RecordField} */
            const field = fieldOrRecord;
            const field0 = _0(field);
            if (type === "compute") {
                if (!this0.FC_QUEUE.some((f) => _0(f) === field0)) {
                    this0.FC_QUEUE.push(field);
                }
            }
            if (type === "sort") {
                if (!field0.value?.definition.sort) {
                    return;
                }
                if (!this0.FS_QUEUE.some((f) => _0(f) === field0)) {
                    this0.FS_QUEUE.push(field);
                }
            }
            if (type === "onAdd") {
                if (field0.value?.definition.sort) {
                    this0.ADD_QUEUE(fieldOrRecord, "sort");
                }
                if (!field0.value?.definition.onAdd) {
                    return;
                }
                const item = this0.FA_QUEUE.find((item) => _0(item.field) === field0);
                if (!item) {
                    this0.FA_QUEUE.push({ field, records: [record] });
                } else {
                    if (!item.records.some((r) => r.eq(record))) {
                        item.records.push(record);
                    }
                }
            }
            if (type === "onDelete") {
                if (!field0.value?.definition.onDelete) {
                    return;
                }
                const item = this0.FD_QUEUE.find((item) => _0(item.field) === field0);
                if (!item) {
                    this0.FD_QUEUE.push({ field, records: [record] });
                } else {
                    if (!item.records.some((r) => r.eq(record))) {
                        item.records.push(record);
                    }
                }
            }
            if (type === "onUpdate") {
                if (!this0.FU_QUEUE.some((f) => _0(f) === field0)) {
                    this0.FU_QUEUE.push(field);
                }
            }
        }
    }
    /**
     * @param {Record} record
     * @param {Object} vals
     */
    updateFields(record, vals) {
        for (const [fieldName, value] of Object.entries(vals)) {
            if (record?.[STORE_SYM] && fieldName in record.Models) {
                if (record.storeReady) {
                    // "store[Model] =" is considered a Model.insert()
                    record[fieldName].insert(value);
                } else {
                    record[fieldName] = value;
                }
            } else if (record.Model.INSTANCE_INTERNALS[fieldName]) {
                record[fieldName] = value;
            } else {
                let definition = record.Model._fields.get(fieldName);
                if (!definition) {
                    // dynamically add attr field definition on the fly
                    definition = new FieldDefinition({
                        [ATTR_SYM]: true,
                        name: fieldName,
                        Model: record.Model,
                    });
                    record.Model._fields.set(fieldName, definition);
                }
                if (!record._fields.get(fieldName)) {
                    const field = new RecordField({ definition, owner: record });
                    record._fields.set(fieldName, field);
                }
                if (isAttr(definition)) {
                    this.updateAttr(record, fieldName, value);
                } else {
                    this.updateRelation(record, fieldName, value);
                }
            }
        }
    }
    /**
     * @param {Record} record
     * @param {string} fieldName
     * @param {any} value
     */
    updateAttr(record, fieldName, value) {
        const definition = record.Model._fields.get(fieldName);
        // ensure each field write goes through the proxy exactly once to trigger reactives
        const record2 = record._updatingFieldsThroughProxy.has(fieldName) ? record : record._2;
        const field = record._fields.get(fieldName);
        if (
            definition?.html &&
            this.trusted &&
            typeof value === "string" &&
            !(value instanceof Markup)
        ) {
            if (field.value?.toString() !== value || record[fieldName]?.toString() !== value) {
                field.ts = field.definition.NEXT_TS++;
                record._updatingAttrs.add(fieldName);
                if (record2 === record) {
                    record2._fields.get(fieldName).value = markup(value);
                } else {
                    record2[fieldName] = markup(value);
                }
                record._updatingAttrs.delete(fieldName);
            }
        } else {
            if (field.value !== value || record[fieldName] !== value) {
                field.ts = field.definition.NEXT_TS++;
                record._updatingAttrs.add(fieldName);
                if (record2 === record) {
                    record2._fields.get(fieldName).value = value;
                } else {
                    record2[fieldName] = value;
                }
                record._updatingAttrs.delete(fieldName);
            }
        }
    }
    /**
     * @param {Record} record
     * @param {string} fieldName
     * @param {any} value
     */
    updateRelation(record, fieldName, value) {
        /** @type {RecordList<Record>} */
        const recordList = record._fields.get(fieldName).value;
        if (isMany(recordList)) {
            this.updateRelationMany(recordList, value);
        } else {
            this.updateRelationOne(recordList, value);
        }
    }
    /**
     * @param {RecordList} recordList
     * @param {any} value
     */
    updateRelationMany(recordList, value) {
        if (isCommand(value)) {
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
    updateRelationOne(recordList, value) {
        if (isCommand(value)) {
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
    sortRecordList(reclist3, func) {
        const reclist0 = _0(reclist3);
        // sort on copy of list so that reactive observers not triggered while sorting
        const records3 = reclist3.state.data.map((localId) =>
            reclist3.store.localIdToRecord.get(localId)
        );
        records3.sort(func);
        const data = records3.map((record3) => _0(record3).localId);
        const hasChanged = reclist0.state.data.some((localId, i) => localId !== data[i]);
        if (hasChanged) {
            reclist3.state.data = data;
        }
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
    _onChange(record, key, callback) {
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
                this._onChange(record, k, callback);
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
    storeReady = false;
    /**
     * @param {string} objectId
     * @returns {Record}
     */
    get(objectId) {
        return this.localIdToRecord.get(this.objectIdToLocalId.get(objectId));
    }
    /**
     * @template T
     * @param {T} dataByModelName
     * @param {Object} [options={}]
     * @returns {{ [K in keyof T]: T[K] extends Array ? import("models").Models[K][] : import("models").Models[K] }}
     */
    insert(dataByModelName, options = {}) {
        const self = this;
        return Record.MAKE_UPDATE(function store_insert() {
            const res = {};
            for (const [modelName, data] of Object.entries(dataByModelName)) {
                res[modelName] = self[modelName].insert(data, options);
            }
            return res;
        });
    }
}
