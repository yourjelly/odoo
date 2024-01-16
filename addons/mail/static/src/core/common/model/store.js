/* @odoo-module */

import { markRaw, markup, reactive, toRaw } from "@odoo/owl";
import { Record } from "./record";
import { ATTR_SYM, Markup, STORE_SYM, _0, isCommand } from "./misc";
import { Deferred } from "@web/core/utils/concurrency";
import { rpc } from "@web/core/network/rpc";
import { debounce } from "@bus/workers/websocket_worker_utils";
import { user } from "@web/core/user";

export class Store extends Record {
    static FETCH_DATA_DEBOUNCE_DELAY = 1;
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
    /** @type {Map<import("./record").Record, Map<string, true>>} */
    FC_QUEUE = markRaw(new Map()); // field-computes
    /** @type {Map<import("./record").Record, Map<string, true>>} */
    FS_QUEUE = markRaw(new Map()); // field-sorts
    /** @type {Map<import("./record").Record, Map<string, Map<import("./record").Record, true>>>} */
    FA_QUEUE = markRaw(new Map()); // field-onadds
    /** @type {Map<import("./record").Record, Map<string, Map<import("./record").Record, true>>>} */
    FD_QUEUE = markRaw(new Map()); // field-ondeletes
    /** @type {Map<import("./record").Record, Map<string, true>>} */
    FU_QUEUE = markRaw(new Map()); // field-onupdates
    /** @type {Map<Function, true>} */
    RO_QUEUE = markRaw(new Map()); // record-onchanges
    /** @type {Map<Record, true>} */
    RD_QUEUE = markRaw(new Map()); // record-deletes
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
                this0.FC_QUEUE.size > 0 ||
                this0.FS_QUEUE.size > 0 ||
                this0.FA_QUEUE.size > 0 ||
                this0.FD_QUEUE.size > 0 ||
                this0.FU_QUEUE.size > 0 ||
                this0.RO_QUEUE.size > 0 ||
                this0.RD_QUEUE.size > 0
            ) {
                const FC_QUEUE = new Map(this0.FC_QUEUE);
                const FS_QUEUE = new Map(this0.FS_QUEUE);
                const FA_QUEUE = new Map(this0.FA_QUEUE);
                const FD_QUEUE = new Map(this0.FD_QUEUE);
                const FU_QUEUE = new Map(this0.FU_QUEUE);
                const RO_QUEUE = new Map(this0.RO_QUEUE);
                const RD_QUEUE = new Map(this0.RD_QUEUE);
                this0.FC_QUEUE.clear();
                this0.FS_QUEUE.clear();
                this0.FA_QUEUE.clear();
                this0.FD_QUEUE.clear();
                this0.FU_QUEUE.clear();
                this0.RO_QUEUE.clear();
                this0.RD_QUEUE.clear();
                while (FC_QUEUE.size > 0) {
                    const [record, recMap] = FC_QUEUE.entries().next().value;
                    FC_QUEUE.delete(record);
                    for (const fieldName of recMap.keys()) {
                        record.requestComputeField(fieldName, { force: true });
                    }
                }
                while (FS_QUEUE.size > 0) {
                    const [record, recMap] = FS_QUEUE.entries().next().value;
                    FS_QUEUE.delete(record);
                    for (const fieldName of recMap.keys()) {
                        record.requestSortField(fieldName, { force: true });
                    }
                }
                while (FA_QUEUE.size > 0) {
                    const [record, recMap] = FA_QUEUE.entries().next().value;
                    FA_QUEUE.delete(record);
                    while (recMap.size > 0) {
                        const [fieldName, fieldMap] = recMap.entries().next().value;
                        recMap.delete(fieldName);
                        const onAdd = record.Model.fieldsOnAdd.get(fieldName);
                        for (const addedRec of fieldMap.keys()) {
                            onAdd?.call(record._2, addedRec._2);
                        }
                    }
                }
                while (FD_QUEUE.size > 0) {
                    const [record, recMap] = FD_QUEUE.entries().next().value;
                    FD_QUEUE.delete(record);
                    while (recMap.size > 0) {
                        const [fieldName, fieldMap] = recMap.entries().next().value;
                        recMap.delete(fieldName);
                        const onDelete = record.Model.fieldsOnDelete.get(fieldName);
                        for (const removedRec of fieldMap.keys()) {
                            onDelete?.call(record._2, removedRec._2);
                        }
                    }
                }
                while (FU_QUEUE.size > 0) {
                    const [record, map] = FU_QUEUE.entries().next().value;
                    FU_QUEUE.delete(record);
                    for (const fieldName of map.keys()) {
                        record.onUpdateField(fieldName);
                    }
                }
                while (RO_QUEUE.size > 0) {
                    const cb = RO_QUEUE.keys().next().value;
                    RO_QUEUE.delete(cb);
                    cb();
                }
                while (RD_QUEUE.size > 0) {
                    const record = RD_QUEUE.keys().next().value;
                    RD_QUEUE.delete(record);
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
                            if (usingRecord2.Model.fieldsMany.get(name2)) {
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
     * @param {"compute"|"sort"|"onAdd"|"onDelete"|"onUpdate"} type
     * @param {...any} params
     */
    ADD_QUEUE(type, ...params) {
        const this0 = _0(this);
        switch (type) {
            case "delete": {
                /** @type {Record} */
                const [record] = params;
                if (!this0.RD_QUEUE.has(record)) {
                    this0.RD_QUEUE.set(record, true);
                }
                break;
            }
            case "compute": {
                /** @type {[Record, string]} */
                const [record, fieldName] = params;
                let recMap = this0.FC_QUEUE.get(record);
                if (!recMap) {
                    recMap = new Map();
                    this0.FC_QUEUE.set(record, recMap);
                }
                recMap.set(fieldName, true);
                break;
            }
            case "sort": {
                /** @type {[Record, string]} */
                const [record, fieldName] = params;
                let recMap = this0.FS_QUEUE.get(record);
                if (!recMap) {
                    recMap = new Map();
                    this0.FS_QUEUE.set(record, recMap);
                }
                recMap.set(fieldName, true);
                break;
            }
            case "onAdd": {
                /** @type {[Record, string, Record]} */
                const [record, fieldName, addedRec] = params;
                const Model = record.Model;
                if (Model.fieldsSort.get(fieldName)) {
                    this0.ADD_QUEUE("sort", record, fieldName);
                }
                if (!Model.fieldsOnAdd.get(fieldName)) {
                    return;
                }
                let recMap = this0.FA_QUEUE.get(record);
                if (!recMap) {
                    recMap = new Map();
                    this0.FA_QUEUE.set(record, recMap);
                }
                let fieldMap = recMap.get(fieldName);
                if (!fieldMap) {
                    fieldMap = new Map();
                    recMap.set(fieldName, fieldMap);
                }
                fieldMap.set(addedRec, true);
                break;
            }
            case "onDelete": {
                /** @type {[Record, string, Record]} */
                const [record, fieldName, removedRec] = params;
                const Model = record.Model;
                if (!Model.fieldsOnDelete.get(fieldName)) {
                    return;
                }
                let recMap = this0.FD_QUEUE.get(record);
                if (!recMap) {
                    recMap = new Map();
                    this0.FD_QUEUE.set(record, recMap);
                }
                let fieldMap = recMap.get(fieldName);
                if (!fieldMap) {
                    fieldMap = new Map();
                    recMap.set(fieldName, fieldMap);
                }
                fieldMap.set(removedRec, true);
                break;
            }
            case "onUpdate": {
                /** @type {[Record, string]} */
                const [record, fieldName] = params;
                let recMap = this0.FU_QUEUE.get(record);
                if (!recMap) {
                    recMap = new Map();
                    this0.FU_QUEUE.set(record, recMap);
                }
                recMap.set(fieldName, true);
                break;
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
                const Model = record.Model;
                if (!Model.fields.has(fieldName)) {
                    // dynamically add attr field definition on the fly
                    Model.prepareField(fieldName, { [ATTR_SYM]: true });
                    record.prepareField(fieldName);
                }
                if (Model.fieldsAttr.has(fieldName)) {
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
        const Model = record.Model;
        // ensure each field write goes through the proxy exactly once to trigger reactives
        const record2 = record._updatingFieldsThroughProxy.has(fieldName) ? record : record._2;
        let shouldChange = record._fields.get(fieldName) !== value;
        let newValue = value;
        if (Model.fieldsHtml.has(fieldName) && this.trusted) {
            shouldChange =
                record._fields.get(fieldName)?.toString() !== value?.toString() ||
                !(record._fields.get(fieldName) instanceof Markup);
            newValue = typeof value === "string" ? markup(value) : value;
        }
        if (shouldChange) {
            const nextTs = Model.fieldsNextTs.get(fieldName);
            record.fieldsTs.set(fieldName, nextTs);
            Model.fieldsNextTs.set(fieldName, nextTs + 1);
            record._updatingFieldsThroughProxy.add(fieldName);
            record._updatingAttrs.add(fieldName);
            if (record2 === record) {
                record2._fields.set(fieldName, newValue);
            } else {
                record2[fieldName] = newValue;
            }
            record._updatingAttrs.delete(fieldName);
            record._updatingFieldsThroughProxy.delete(fieldName);
        }
    }
    /**
     * @param {Record} record
     * @param {string} fieldName
     * @param {any} value
     */
    updateRelation(record, fieldName, value) {
        /** @type {RecordList<Record>} */
        const recordList = record._fields.get(fieldName);
        if (record.Model.fieldsMany.get(fieldName)) {
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
    // Internal props on instance. Important to not have them being registered as fields!
    static get INSTANCE_INTERNALS() {
        return {
            ...super.INSTANCE_INTERNALS,
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
            storeReady: true,
            fetchDeferred: true,
            fetchParams: true,
            fetchReadonly: true,
            fetchSilent: true,
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
    async fetchData(params, { readonly = true, silent = true } = {}) {
        Object.assign(this.fetchParams, params);
        this.fetchReadonly = this.fetchReadonly && readonly;
        this.fetchSilent = this.fetchSilent && silent;
        const fetchDeferred = this.fetchDeferred;
        this._fetchDataDebounced();
        return fetchDeferred;
    }
    fetchDeferred = new Deferred();
    fetchParams = {};
    fetchReadonly = true;
    fetchSilent = true;
    async _fetchDataDebounced() {
        const fetchDeferred = this.fetchDeferred;
        this.fetchParams.context = {
            ...user.context,
            ...this.fetchParams.context,
        };
        rpc(this.fetchReadonly ? "/mail/data" : "/mail/action", this.fetchParams, {
            silent: this.fetchSilent,
        }).then(
            (data) => {
                const recordsByModel = this.insert(data, { html: true });
                fetchDeferred.resolve(recordsByModel);
            },
            (error) => fetchDeferred.reject(error)
        );
        this.fetchDeferred = new Deferred();
        this.fetchParams = {};
        this.fetchReadonly = true;
        this.fetchSilent = true;
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
    constructor() {
        super();
        this._fetchDataDebounced = debounce(
            this._fetchDataDebounced,
            Store.FETCH_DATA_DEBOUNCE_DELAY
        );
    }
}
