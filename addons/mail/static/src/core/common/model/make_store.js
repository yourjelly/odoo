/* @odoo-module */

import { reactive } from "@odoo/owl";
import {
    RECORD_SYM,
    STORE_SYM,
    modelRegistry,
    _0,
    isRelation,
    AND_SYM,
    OR_SYM,
    ATTR_SYM,
    FIELD_DEFINITION_SYM,
} from "./misc";
import { Store } from "./store";
import { assignDefined } from "@mail/utils/common/misc";
import { Record } from "./record";

export function makeStore(env) {
    const localIdToRecord = reactive(new Map());
    const objectIdToLocalId = new Map();
    const dummyStore = new Store();
    dummyStore.localIdToRecord = localIdToRecord;
    dummyStore.objectIdToLocalId = objectIdToLocalId;
    dummyStore.env = env;
    let store = dummyStore;
    Record.store0 = dummyStore;
    /** @type {Object<string, typeof Record>} */
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
                            if (!Model.fields.has(name)) {
                                return Reflect.get(this0, name, this3);
                            }
                            if (Model.fieldsCompute.get(name) && !Model.fieldsEager.get(name)) {
                                this0.fieldsComputeInNeed.set(name, true);
                                if (this0.fieldsComputeOnNeed.get(name)) {
                                    this0.computeField(name);
                                }
                            }
                            if (Model.fieldsSort.get(name) && !Model.fieldsEager.get(name)) {
                                this0.fieldsSortInNeed.set(name, true);
                                if (this0.fieldsSortOnNeed.get(name)) {
                                    this0.sortField(name);
                                }
                            }
                            if (isRelation(Model, name)) {
                                const reclist3 = this3._fields.get(name)._1;
                                if (Model.fieldsMany.get(name)) {
                                    return reclist3;
                                }
                                return reclist3[0];
                            }
                            return this3._fields.get(name);
                        },
                        deleteProperty(this0, name) {
                            return store.MAKE_UPDATE(function R_deleteProperty() {
                                if (isRelation(Model, name)) {
                                    const reclist = this0._fields.get(name);
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
                                this0._fields.set(name, val);
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
                    for (const fieldName of Model.fields.keys()) {
                        this0.prepareField(fieldName);
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
            ...Record.makeFieldMaps(),
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
            if (val?.[FIELD_DEFINITION_SYM]) {
                Model.prepareField(name, val);
            } else {
                Model.prepareField(name, { [ATTR_SYM]: true, default: val });
            }
        }
    }
    // Sync inverse fields
    for (const Model of Object.values(Models)) {
        for (const fieldName of Model.fields.keys()) {
            if (!isRelation(Model, fieldName)) {
                continue;
            }
            const targetModel = Model.fieldsTargetModel.get(fieldName);
            const inverse = Model.fieldsInverse.get(fieldName);
            if (targetModel && !Models[targetModel]) {
                throw new Error(`No target model ${targetModel} exists`);
            }
            if (inverse) {
                const OtherModel = Models[targetModel];
                const rel2TargetModel = OtherModel.fieldsTargetModel.get(inverse);
                const rel2Inverse = OtherModel.fieldsInverse.get(inverse);
                if (rel2TargetModel && rel2TargetModel !== Model.name) {
                    throw new Error(
                        `Fields ${Models[targetModel].name}.${inverse} has wrong targetModel. Expected: "${Model.name}" Actual: "${rel2TargetModel}"`
                    );
                }
                if (rel2Inverse && rel2Inverse !== fieldName) {
                    throw new Error(
                        `Fields ${Models[targetModel].name}.${inverse} has wrong inverse. Expected: "${fieldName}" Actual: "${rel2Inverse}"`
                    );
                }
                OtherModel.fieldsTargetModel.set(inverse, Model.name);
                OtherModel.fieldsInverse.set(inverse, fieldName);
                // FIXME: lazy fields are not working properly with inverse.
                Model.fieldsEager.set(fieldName, true);
                OtherModel.fieldsEager.set(inverse, true);
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
