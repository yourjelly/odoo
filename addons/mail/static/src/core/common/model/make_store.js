/* @odoo-module */

import { reactive } from "@odoo/owl";
import {
    RECORD_SYM,
    STORE_SYM,
    modelRegistry,
    _0,
    isField,
    isMany,
    isRelation,
    AND_SYM,
    OR_SYM,
    ATTR_SYM,
} from "./misc";
import { Store } from "./store";
import { assignDefined, onChange } from "@mail/utils/common/misc";
import { RecordList } from "./record_list";
import { Record } from "./record";
import { RecordField } from "./record_field";
import { FieldDefinition } from "./field_definition";

export function makeStore(env) {
    const localIdToRecord = reactive(new Map());
    const objectIdToLocalId = new Map();
    const dummyStore = new Store();
    dummyStore.localIdToRecord = localIdToRecord;
    dummyStore.objectIdToLocalId = objectIdToLocalId;
    dummyStore.env = env;
    let store = dummyStore;
    Record.store0 = dummyStore;
    const Models = {};
    dummyStore.Models = Models;
    const OgClasses = {};
    for (const [name, _OgClass] of modelRegistry.getEntries()) {
        /** @type {typeof Record} */
        const OgClass = _OgClass;
        OgClasses[name] = OgClass;
        if (store[name]) {
            throw new Error(`There must be no duplicated Model Names (duplicate found: ${name})`);
        }
        // classes cannot be made reactive because they are functions and they are not supported.
        // work-around: make an object whose prototype is the class, so that static props become
        // instance props.
        /** @type {typeof Record} */
        const Model = Object.create(OgClass);
        // Produce another class with changed prototype, so that there are automatic get/set on relational fields
        const Class = {
            [OgClass.name]: class extends OgClass {
                [RECORD_SYM] = true;
                constructor() {
                    super();
                    const this0 = this;
                    this0._updatingFieldsThroughProxy = new Set();
                    this0._updatingAttrs = new Set();
                    this0._0 = this0;
                    this0.Model = Model;
                    const this1 = new Proxy(this0, {
                        get(this0, name, this3) {
                            this3 = this0._downgradeProxy(this3);
                            const field = this0._fields.get(name);
                            if (!field) {
                                return Reflect.get(this0, name, this3);
                            }
                            if (field.compute && !field.eager) {
                                field.computeInNeed = true;
                                if (field.computeOnNeed) {
                                    field.compute();
                                }
                            }
                            if (field.sort && !field.eager) {
                                field.sortInNeed = true;
                                if (field.sortOnNeed) {
                                    field.sort();
                                }
                            }
                            if (isRelation(field)) {
                                const reclist = field.value;
                                const reclist3 = this3._fields.get(name).value._1;
                                if (isMany(reclist)) {
                                    return reclist3;
                                }
                                return reclist3[0];
                            }
                            return this3._fields.get(name).value;
                        },
                        deleteProperty(this0, name) {
                            return store.MAKE_UPDATE(function R_deleteProperty() {
                                const field = this0._fields.get(name);
                                if (field && isRelation(field)) {
                                    const reclist = field.value;
                                    reclist.clear();
                                    return true;
                                }
                                return Reflect.deleteProperty(this0, name);
                            });
                        },
                        /**
                         * Using record.update(data) is preferable for performance to batch process
                         * when updating multiple fields at the same time.
                         */
                        set(this0, name, val) {
                            if (this0._customAssignThroughProxy) {
                                const fn = this0._customAssignThroughProxy.bind(this0);
                                this0._customAssignThroughProxy = undefined;
                                fn();
                                return true;
                            }
                            // ensure each field write goes through the updateFields method exactly once
                            if (this0._updatingAttrs.has(name)) {
                                this0._fields.get(name).value = val;
                                return true;
                            }
                            return store.MAKE_UPDATE(function R_set() {
                                this0._updatingFieldsThroughProxy.add(name);
                                store.updateFields(this0, { [name]: val });
                                this0._updatingFieldsThroughProxy.delete(name);
                                return true;
                            });
                        },
                    });
                    this0._1 = this1;
                    const this2 = reactive(this1);
                    this0._2 = this2;
                    if (this0?.[STORE_SYM]) {
                        assignDefined(this0, dummyStore, [
                            "Models",
                            "localIdToRecord",
                            "objectIdToRecord",
                            "trusted",
                            "FC_QUEUE",
                            "FS_QUEUE",
                            "FA_QUEUE",
                            "FD_QUEUE",
                            "FU_QUEUE",
                            "RO_QUEUE",
                            "RD_QUEUE",
                        ]);
                        Record.store0 = this0;
                        store = this0;
                    }
                    for (const [name, definition] of Model._fields) {
                        const field = new RecordField({ definition, owner: this0 });
                        this0._fields.set(name, field);
                        if (isRelation(field)) {
                            const reclist0 = new RecordList({ field, store });
                            reclist0._0 = reclist0;
                            field.value = reclist0;
                            field.registerOnChangeRecomputeObjectId();
                        } else {
                            this2[name] = definition.default;
                        }
                        if (definition.compute) {
                            if (!definition.eager) {
                                onChange(this2, name, () => {
                                    if (field.computing) {
                                        /**
                                         * Use a reactive to reset the computeInNeed flag when there is
                                         * a change. This assumes when other reactive are still
                                         * observing the value, its own callback will reset the flag to
                                         * true through the proxy getters.
                                         */
                                        field.computeInNeed = false;
                                    }
                                });
                                // reset flags triggered by registering onChange
                                field.computeInNeed = false;
                                field.sortInNeed = false;
                            }
                            const proxy2 = reactive(this2, function RF_computeObserver() {
                                field.requestCompute();
                            });
                            Object.assign(field, {
                                compute: () => {
                                    field.computing = true;
                                    field.computeOnNeed = false;
                                    store.MAKE_UPDATE(() => {
                                        store.updateFields(this0, {
                                            [name]: definition.compute.call(proxy2),
                                        });
                                    });
                                    field.computing = false;
                                },
                                requestCompute: ({ force = false } = {}) => {
                                    if (store.UPDATE !== 0 && !force) {
                                        store.ADD_QUEUE(field, "compute");
                                    } else {
                                        if (field.eager || field.computeInNeed) {
                                            field.compute();
                                        } else {
                                            field.computeOnNeed = true;
                                        }
                                    }
                                },
                            });
                        }
                        if (definition.sort) {
                            if (!definition.eager) {
                                onChange(this2, name, () => {
                                    if (field.sorting) {
                                        /**
                                         * Use a reactive to reset the inNeed flag when there is a
                                         * change. This assumes if another reactive is still observing
                                         * the value, its own callback will reset the flag to true
                                         * through the proxy getters.
                                         */
                                        field.sortInNeed = false;
                                    }
                                });
                                // reset flags triggered by registering onChange
                                field.computeInNeed = false;
                                field.sortInNeed = false;
                            }
                            const proxy2 = reactive(this2, function RF_sortObserver() {
                                field.requestSort();
                            });
                            Object.assign(field, {
                                sort: () => {
                                    field.sortOnNeed = false;
                                    field.sorting = true;
                                    store.MAKE_UPDATE(() => {
                                        store.sortRecordList(
                                            proxy2._fields.get(name).value._2,
                                            definition.sort.bind(proxy2)
                                        );
                                    });
                                    field.sorting = false;
                                },
                                requestSort: ({ force } = {}) => {
                                    if (store.UPDATE !== 0 && !force) {
                                        store.ADD_QUEUE(field, "sort");
                                    } else {
                                        if (field.eager || field.sortInNeed) {
                                            field.sort();
                                        } else {
                                            field.sortOnNeed = true;
                                        }
                                    }
                                },
                            });
                        }
                        if (definition.onUpdate) {
                            /** @type {Function} */
                            let observe;
                            Object.assign(field, {
                                onUpdate: () => {
                                    store.MAKE_UPDATE(() => {
                                        /**
                                         * Forward internal proxy for performance as onUpdate does not
                                         * need reactive (observe is called separately).
                                         */
                                        definition.onUpdate.call(this0._1);
                                        observe?.();
                                    });
                                },
                            });
                            store._onChange(this2, name, (obs) => {
                                observe = obs;
                                if (store.UPDATE !== 0) {
                                    store.ADD_QUEUE(field, "onUpdate");
                                } else {
                                    field.onUpdate();
                                }
                            });
                        }
                    }
                    return this2;
                }
            },
        }[OgClass.name];
        // Produce _id and objectIdFields
        // For more structured object id mapping and re-shape on change of object id.
        // Useful for support of multi-identification on records
        if (Model.id === undefined) {
            Model._id = [];
            Model.objectIdFields = {};
        } else if (typeof Model.id === "string") {
            Model._id = [[Model.id]];
            Model.objectIdFields = { [Model.id]: true };
        } else if (Model.id[0] === AND_SYM) {
            const fields = Model.id.slice(1);
            Model._id = [[...fields]];
            Model.objectIdFields = Object.fromEntries(fields.map((i) => [i, true]));
        } else if (Model.id[0] === OR_SYM) {
            const fields = Model.id.slice(1);
            Model._id = [...fields.map((i) => [i])];
            Model.objectIdFields = Object.fromEntries(fields.map((i) => [i, true]));
        } else {
            const _id = [];
            const objectIdFields = {};
            // this is an array of string and AND expressions
            for (const item of Model.id) {
                if (typeof item === "string") {
                    _id.push([item]);
                    if (!objectIdFields[item]) {
                        objectIdFields[item] = true;
                    }
                } else if (item[0] === AND_SYM) {
                    const fields = item.slice(1);
                    _id.push([...fields]);
                    for (const f of fields) {
                        if (!objectIdFields[f]) {
                            objectIdFields[f] = true;
                        }
                    }
                } else {
                    _id.push([...item]);
                    for (const f of item) {
                        if (!objectIdFields[f]) {
                            objectIdFields[f] = true;
                        }
                    }
                }
            }
            Object.assign(Model, { _id, objectIdFields });
        }
        Object.assign(Model, {
            Class,
            NEXT_LOCAL_ID: 1,
            env,
            records: reactive({}),
            _fields: new Map(),
        });
        Models[name] = Model;
        store[name] = Model;
    }
    for (const Model of Object.values(Models)) {
        // Detect fields with a dummy record and setup getter/setters on them
        const obj = new OgClasses[Model.name]();
        for (const [name, val] of Object.entries(obj)) {
            if (obj?.[STORE_SYM] && name in Models) {
                continue;
            }
            if (Model.INSTANCE_INTERNALS[name]) {
                continue;
            }
            /** @type {FieldDefinition} */
            let definition;
            if (!isField(val)) {
                // dynamically add attr field definition on the fly
                definition = new FieldDefinition({ [ATTR_SYM]: true, default: val });
            } else {
                definition = val;
            }
            definition.Model = Model;
            definition.name = name;
            Model._fields.set(name, definition);
        }
    }
    // Sync inverse fields
    for (const Model of Object.values(Models)) {
        for (const [name, definition] of Model._fields) {
            if (!isRelation(definition)) {
                continue;
            }
            const { targetModel, inverse } = definition;
            if (targetModel && !Models[targetModel]) {
                throw new Error(`No target model ${targetModel} exists`);
            }
            if (inverse) {
                const rel2 = Models[targetModel]._fields.get(inverse);
                if (rel2.targetModel && rel2.targetModel !== Model.name) {
                    throw new Error(
                        `Fields ${Models[targetModel].name}.${inverse} has wrong targetModel. Expected: "${Model.name}" Actual: "${rel2.targetModel}"`
                    );
                }
                if (rel2.inverse && rel2.inverse !== name) {
                    throw new Error(
                        `Fields ${Models[targetModel].name}.${inverse} has wrong inverse. Expected: "${name}" Actual: "${rel2.inverse}"`
                    );
                }
                Object.assign(rel2, { targetModel: Model.name, inverse: name });
                // // FIXME: lazy fields are not working properly with inverse.
                definition.eager = true;
                rel2.eager = true;
            }
        }
    }
    /**
     * store/store0 are assigned on models at next step, but they are
     * required on Store model to make the initial store insert.
     */
    Object.assign(store.Store, { store, store0: store });
    // Make true store (as a model)
    store = _0(store.Store.insert());
    for (const Model of Object.values(Models)) {
        Model.store0 = store;
        Model.store = store._2;
        store._2[Model.name] = Model;
    }
    Object.assign(store, { storeReady: true });
    return store._2;
}
