/* @odoo-module */

import { reactive, toRaw } from "@odoo/owl";
import { _0, isOne, isRecord } from "./misc";

/** * @template {Record} R */
export class RecordList extends Array {
    /** @type {Record} */
    owner;
    /** @type {string} */
    name;
    /** @type {import("models").Store} */
    store;
    /** @type {string[]} */
    data = [];
    /** @type {this} */
    _0; // previously "_raw"
    /** @type {this} */
    _1; // previously "_proxyInternal"
    /** @type {this} */
    _2; // previously "_proxy"
    /** @type {RecordField} */
    field;

    get definition() {
        return this.owner.Model._fields.get(this.name);
    }

    constructor() {
        super();
        const this0 = this;
        this0._0 = this0;
        const this1 = new Proxy(this0, {
            /** @param {RecordList<R>} this3 */
            get(this0, name, this3) {
                this3 = this0._downgradeProxy(this3);
                if (
                    typeof name === "symbol" ||
                    Object.keys(this0).includes(name) ||
                    Object.prototype.hasOwnProperty.call(this0.constructor.prototype, name)
                ) {
                    return Reflect.get(this0, name, this3);
                }
                if (this0.field?.compute && !this0.field.eager) {
                    this0.field.computeInNeed = true;
                    if (this0.field.computeOnNeed) {
                        this0.field.compute();
                    }
                }
                if (name === "length") {
                    return this3.data.length;
                }
                if (this0.field?.sort && !this0.field.eager) {
                    this0.field.sortInNeed = true;
                    if (this0.field.sortOnNeed) {
                        this0.field.sort();
                    }
                }
                if (typeof name !== "symbol" && !window.isNaN(parseInt(name))) {
                    // support for "array[index]" syntax
                    const index = parseInt(name);
                    return this3.store.recordByLocalId.get(this3.data[index]);
                }
                // Attempt an unimplemented array method call
                const array = [...this0._1[Symbol.iterator].call(this3)];
                return array[name]?.bind(array);
            },
            /** @param {RecordList<R>} this3 */
            set(this0, name, val, this3) {
                return this0.store.MAKE_UPDATE(function RL_set() {
                    if (typeof name !== "symbol" && !window.isNaN(parseInt(name))) {
                        // support for "array[index] = r3" syntax
                        const index = parseInt(name);
                        this0._insert(val, function RL_set_insert(newRecord) {
                            const oldRecord = toRaw(this0.store.recordByLocalId).get(
                                this0.data[index]
                            );
                            if (oldRecord && oldRecord.notEq(newRecord)) {
                                oldRecord.__uses__.delete(this0);
                            }
                            this0.store.ADD_QUEUE(this0.field, "onDelete", oldRecord);
                            const { inverse } = this0.definition;
                            if (inverse) {
                                oldRecord._fields.get(inverse).value.delete(this0);
                            }
                            this3.data[index] = newRecord?.localId;
                            if (newRecord) {
                                newRecord.__uses__.add(this0);
                                this0.store.ADD_QUEUE(this0.field, "onAdd", newRecord);
                                const { inverse } = this0.definition;
                                if (inverse) {
                                    newRecord._fields.get(inverse).value.add(this0);
                                }
                            }
                        });
                    } else if (name === "length") {
                        const newLength = parseInt(val);
                        if (newLength !== this0.data.length) {
                            if (newLength < this0.data.length) {
                                this0.splice.call(this3, newLength, this0.length - newLength);
                            }
                            this3.data.length = newLength;
                        }
                    } else {
                        return Reflect.set(this0, name, val, this3);
                    }
                    return true;
                });
            },
        });
        this0._1 = this1;
        this0._2 = reactive(this1);
        return this0;
    }

    /**
     * The internal reactive is only necessary to trigger outer reactives when
     * writing on it. As it has no callback, reading through it has no effect,
     * except slowing down performance and complexifying the stack.
     *
     * @param {this} this3
     */
    _downgradeProxy(this3) {
        return this._2 === this3 ? this._1 : this3;
    }

    /**
     * @param {R|any} val
     * @param {(R) => void} [fn] function that is called in-between preinsert and
     *   insert. Preinsert only inserted what's needed to make record, while
     *   insert finalize with all remaining data.
     * @param {boolean} [inv=true] whether the inverse should be added or not.
     *   It is always added except when during an insert on a relational field,
     *   in order to avoid infinite loop.
     * @param {"ADD"|"DELETE} [mode="ADD"] the mode of insert on the relation.
     *   Important to match the inverse. Most of the time it's "ADD", that is when
     *   inserting the relation the inverse should be added. Exception when the insert
     *   comes from deletion, we want to "DELETE".
     */
    _insert(val, fn, { inv = true, mode = "ADD" } = {}) {
        const { inverse } = this.definition;
        if (inverse && inv) {
            // special command to call _addNoinv/_deleteNoInv, to prevent infinite loop
            val[inverse] = [[mode === "ADD" ? "ADD.noinv" : "DELETE.noinv", this.owner]];
        }
        /** @type {R} */
        let newRecord3;
        if (!isRecord(val)) {
            const { targetModel } = this.definition;
            newRecord3 = this.store[targetModel].preinsert(val);
        } else {
            newRecord3 = val;
        }
        const newRecord0 = _0(newRecord3);
        fn?.(newRecord0);
        if (!isRecord(val)) {
            // was preinserted, fully insert now
            const { targetModel } = this.definition;
            this.store[targetModel].insert(val);
        }
        return newRecord0;
    }
    /** @param {R[]|any[]} data */
    assign(data) {
        const this0 = _0(this);
        return this0.store.MAKE_UPDATE(function RL_assign() {
            /** @type {Record[]|Set<Record>|RecordList<Record|any[]>} */
            const collection = isRecord(data) ? [data] : data;
            // l1 and collection could be same record list,
            // save before clear to not push mutated recordlist that is empty
            const vals = [...collection];
            /** @type {R[]} */
            const oldRecords2 = this0._1.slice.call(this0._2);
            for (const oldRecord2 of oldRecords2) {
                _0(oldRecord2).__uses__.delete(this0);
            }
            const records2 = vals.map((val) =>
                this0._insert(val, function RL_assign_insert(record) {
                    record.__uses__.add(this0);
                })
            );
            this0._2.data = records2.map((record2) => _0(record2).localId);
        });
    }
    /** @param {R[]} records */
    push(...records) {
        const this0 = _0(this);
        const this3 = this0._downgradeProxy(this);
        return this0.store.MAKE_UPDATE(function RL_push() {
            for (const val of records) {
                const record = this0._insert(val, function RL_push_insert(record) {
                    this0._2.data.push(record.localId);
                    record.__uses__.add(this0);
                });
                this0.store.ADD_QUEUE(this0.field, "onAdd", record);
                const { inverse } = this0.definition;
                if (inverse) {
                    record._fields.get(inverse).value.add(this0.owner);
                }
            }
            return this3.data.length;
        });
    }
    /** @returns {R} */
    pop() {
        const this0 = _0(this);
        const this3 = this0._downgradeProxy(this);
        return this0.store.MAKE_UPDATE(function RL_pop() {
            /** @type {R} */
            const oldRecord3 = this3.at(-1);
            if (oldRecord3) {
                this0.splice.call(this3, this3.length - 1, 1);
            }
            return oldRecord3;
        });
    }
    /** @returns {R} */
    shift() {
        const this0 = _0(this);
        const this3 = this0._downgradeProxy(this);
        return this0.store.MAKE_UPDATE(function RL_shift() {
            const record3 = this3.store.recordByLocalId.get(this3.data.shift());
            if (!record3) {
                return;
            }
            const record0 = _0(record3);
            record0.__uses__.delete(this0);
            this0.store.ADD_QUEUE(this0.field, "onDelete", record0);
            const { inverse } = this0.definition;
            if (inverse) {
                record0._fields.get(inverse).value.delete(this0.owner);
            }
            return record3;
        });
    }
    /** @param {R[]} records */
    unshift(...records) {
        const this0 = _0(this);
        const this3 = this0._downgradeProxy(this);
        return this0.store.MAKE_UPDATE(function RL_unshift() {
            for (let i = records.length - 1; i >= 0; i--) {
                const record = this0._insert(records[i], (record) => {
                    this0._2.data.unshift(record.localId);
                    record.__uses__.add(this0);
                });
                this0.store.ADD_QUEUE(this0.field, "onAdd", record);
                const { inverse } = this0.definition;
                if (inverse) {
                    record._fields.get(inverse).value.add(this0.owner);
                }
            }
            return this3.data.length;
        });
    }
    /** @param {R} record3 */
    indexOf(record3) {
        const this0 = _0(this);
        const this3 = this0._downgradeProxy(this);
        return this3.data.indexOf(_0(record3)?.localId);
    }
    /**
     * @param {number} [start]
     * @param {number} [deleteCount]
     * @param {...R} [newRecords3]
     */
    splice(start, deleteCount, ...newRecords3) {
        const this0 = _0(this);
        const this3 = this0._downgradeProxy(this);
        return this0.store.MAKE_UPDATE(function RL_splice() {
            const oldRecords3 = this0._1.slice.call(this3, start, start + deleteCount);
            const list = this3.data.slice(); // splice on copy of list so that reactive observers not triggered while splicing
            list.splice(
                start,
                deleteCount,
                ...newRecords3.map((newRecord3) => _0(newRecord3).localId)
            );
            this0._2.data = list;
            for (const oldRecord3 of oldRecords3) {
                const oldRecord0 = _0(oldRecord3);
                oldRecord0.__uses__.delete(this0);
                this0.store.ADD_QUEUE(this0.field, "onDelete", oldRecord0);
                const { inverse } = this0.definition;
                if (inverse) {
                    oldRecord0._fields.get(inverse).value.delete(this0.owner);
                }
            }
            for (const newRecord3 of newRecords3) {
                const newRecord = _0(newRecord3);
                newRecord.__uses__.add(this0);
                this0.store.ADD_QUEUE(this0.field, "onAdd", newRecord);
                const { inverse } = this0.definition;
                if (inverse) {
                    newRecord._fields.get(inverse).value.add(this0.owner);
                }
            }
        });
    }
    /** @param {(a: R, b: R) => boolean} func */
    sort(func) {
        const this0 = _0(this);
        const this3 = this0._downgradeProxy(this);
        return this0.store.MAKE_UPDATE(function RL_sort() {
            this0.store.sortRecordList(this3, func);
            return this3;
        });
    }
    /** @param {...R[]|...RecordList[R]} collections */
    concat(...collections) {
        const this0 = _0(this);
        const this3 = this0._downgradeProxy(this);
        return this3.data
            .map((localId) => this3.store.recordByLocalId.get(localId))
            .concat(...collections.map((c) => [...c]));
    }
    /** @param {...R}  */
    add(...records) {
        const this0 = _0(this);
        return this0.store.MAKE_UPDATE(function RL_add() {
            if (isOne(this0)) {
                const last = records.at(-1);
                if (isRecord(last) && this0.data.includes(_0(last).localId)) {
                    return;
                }
                this0._insert(last, function RL_add_insertOne(record) {
                    if (record.localId !== this0.data[0]) {
                        this0.pop.call(this0._2);
                        this0.push.call(this0._2, record);
                    }
                });
                return;
            }
            for (const val of records) {
                if (isRecord(val) && this0.data.includes(val.localId)) {
                    continue;
                }
                this0._insert(val, function RL_add_insertMany(record) {
                    if (this0.data.indexOf(record.localId) === -1) {
                        this0.push.call(this0._2, record);
                    }
                });
            }
        });
    }
    /**
     * Version of add() that does not update the inverse.
     * This is internally called when inserting (with intent to add)
     * on relational field with inverse, to prevent infinite loops.
     *
     * @param {...R}
     */
    _addNoinv(...records) {
        const recordList = this;
        if (isOne(recordList)) {
            const last = records.at(-1);
            if (isRecord(last) && last.in(recordList)) {
                return;
            }
            const record = recordList._insert(
                last,
                function RL_addNoInv_insertOne(record) {
                    if (record.localId !== recordList.data[0]) {
                        const old = recordList._2.at(-1);
                        recordList._2.data.pop();
                        old?.__uses__.delete(recordList);
                        recordList._2.data.push(record.localId);
                        record.__uses__.add(recordList);
                    }
                },
                { inv: false }
            );
            this.store.ADD_QUEUE(recordList.field, "onAdd", record);
            return;
        }
        for (const val of records) {
            if (isRecord(val) && val.in(recordList)) {
                continue;
            }
            const record = recordList._insert(
                val,
                function RL_addNoInv_insertMany(record) {
                    if (recordList.data.indexOf(record.localId) === -1) {
                        recordList.push.call(recordList._2, record);
                        record.__uses__.add(recordList);
                    }
                },
                { inv: false }
            );
            this.store.ADD_QUEUE(recordList.field, "onAdd", record);
        }
    }
    /** @param {...R}  */
    delete(...records) {
        const this0 = _0(this);
        return this0.store.MAKE_UPDATE(function RL_delete() {
            for (const val of records) {
                this0._insert(
                    val,
                    function RL_delete_insert(record) {
                        const index = this0.data.indexOf(record.localId);
                        if (index !== -1) {
                            this0.splice.call(this0._2, index, 1);
                        }
                    },
                    { mode: "DELETE" }
                );
            }
        });
    }
    /**
     * Version of delete() that does not update the inverse.
     * This is internally called when inserting (with intent to delete)
     * on relational field with inverse, to prevent infinite loops.
     *
     * @param {...R}
     */
    _deleteNoinv(...records) {
        const recordList = this;
        for (const val of records) {
            const record = recordList._insert(
                val,
                function RL_deleteNoInv_insert(record) {
                    const index = recordList.data.indexOf(record.localId);
                    if (index !== -1) {
                        recordList.splice.call(recordList._2, index, 1);
                        record.__uses__.delete(recordList);
                    }
                },
                { inv: false }
            );
            this.store.ADD_QUEUE(recordList.field, "onDelete", record);
        }
    }
    clear() {
        const this0 = _0(this);
        return this0.store.MAKE_UPDATE(function RL_clear() {
            while (this0.data.length > 0) {
                this0.pop.call(this0._2);
            }
        });
    }
    /** @yields {R} */
    *[Symbol.iterator]() {
        const this0 = _0(this);
        const this3 = this0._downgradeProxy(this);
        for (const localId of this3.data) {
            yield this3.store.recordByLocalId.get(localId);
        }
    }
}
