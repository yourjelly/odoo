/* @odoo-module */

import { reactive } from "@odoo/owl";
import {
    IS_FIELD_DEFINITION_SYM,
    IS_RECORD_FIELD_SYM,
    IS_RECORD_SYM,
    STORE_SYM,
    modelRegistry,
    _0,
    isField,
    isMany,
    isRelation,
} from "./misc";
import { Store } from "./store";
import { onChange } from "@mail/utils/common/misc";
import { RecordList } from "./record_list";
import { Record } from "./record";

export function makeStore(env) {
    const recordByLocalId = reactive(new Map());
    const dummyStore = new Store();
    dummyStore.recordByLocalId = recordByLocalId;
    dummyStore.env = env;
    const _ = { store: dummyStore };
    Record.store0 = dummyStore;
    const Models = {};
    for (const [name, _OgClass] of modelRegistry.getEntries()) {
        /** @type {typeof Record} */
        const OgClass = _OgClass;
        if (_.store[name]) {
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
                [IS_RECORD_SYM] = true;
                constructor() {
                    super();
                    const this0 = this;
                    this0._proxyUsed = new Set();
                    this0._updateFields = new Set();
                    this0._0 = this0;
                    this0.Model = Model;
                    const this1 = new Proxy(this0, {
                        get(this0, name, this3) {
                            this3 = this0._downgradeProxy(this3);
                            const field = this0._fields.get(name);
                            if (field) {
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
                                    const reclist3 = this3._fields.get(name).value._2;
                                    if (isMany(reclist)) {
                                        return reclist3;
                                    }
                                    return reclist3[0];
                                }
                            }
                            return Reflect.get(this0, name, this3);
                        },
                        deleteProperty(this0, name) {
                            return _.store.MAKE_UPDATE(function R_deleteProperty() {
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
                            // ensure each field write goes through the updateFields method exactly once
                            if (this0._updateFields.has(name)) {
                                this0[name] = val;
                                return true;
                            }
                            return _.store.MAKE_UPDATE(function R_set() {
                                this0._proxyUsed.add(name);
                                _.store.updateFields(this0, { [name]: val });
                                this0._proxyUsed.delete(name);
                                return true;
                            });
                        },
                    });
                    this0._1 = this1;
                    const this2 = reactive(this1);
                    this0._2 = this2;
                    if (this0?.[STORE_SYM]) {
                        _.store = this0;
                    }
                    for (const [name, definition] of Model._fields) {
                        const SYM = this0[name]?.[0];
                        const field = {
                            [IS_RECORD_FIELD_SYM]: true,
                            [SYM]: true,
                            eager: definition.eager,
                            name,
                        };
                        this0._fields.set(name, field);
                        if (isRelation(SYM)) {
                            // Relational fields contain symbols for detection in original class.
                            // This constructor is called on genuine records:
                            // - 'one' fields => undefined
                            // - 'many' fields => RecordList
                            // record[name]?.[0] is ONE_SYM or MANY_SYM
                            const reclist0 = new RecordList();
                            Object.assign(reclist0, {
                                [SYM]: true,
                                field,
                                name,
                                owner: this0,
                                _0: reclist0,
                            });
                            reclist0.store = _.store;
                            field.value = reclist0;
                        } else {
                            this0[name] = definition.default;
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
                                    _.store.updateFields(this0, {
                                        [name]: definition.compute.call(proxy2),
                                    });
                                    field.computing = false;
                                },
                                requestCompute: ({ force = false } = {}) => {
                                    if (_.store.UPDATE !== 0 && !force) {
                                        _.store.ADD_QUEUE(field, "compute");
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
                                    _.store.sortRecordList(
                                        proxy2._fields.get(name).value._2,
                                        definition.sort.bind(proxy2)
                                    );
                                    field.sorting = false;
                                },
                                requestSort: ({ force } = {}) => {
                                    if (_.store.UPDATE !== 0 && !force) {
                                        _.store.ADD_QUEUE(field, "sort");
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
                                    /**
                                     * Forward internal proxy for performance as onUpdate does not
                                     * need reactive (observe is called separately).
                                     */
                                    definition.onUpdate.call(this0._1);
                                    observe?.();
                                },
                            });
                            _.store._onChange(this2, name, (obs) => {
                                observe = obs;
                                if (_.store.UPDATE !== 0) {
                                    _.store.ADD_QUEUE(field, "onUpdate");
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
        Object.assign(Model, {
            Class,
            env,
            records: reactive({}),
            _fields: new Map(),
        });
        Models[name] = Model;
        _.store[name] = Model;
        // Detect fields with a dummy record and setup getter/setters on them
        const obj = new OgClass();
        for (const [name, val] of Object.entries(obj)) {
            const SYM = val?.[0];
            if (!isField(SYM)) {
                continue;
            }
            Model._fields.set(name, { [IS_FIELD_DEFINITION_SYM]: true, [SYM]: true, ...val[1] });
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
     * store/_0store are assigned on models at next step, but they are
     * required on Store model to make the initial store insert.
     */
    Object.assign(_.store.Store, { store: _.store, _0store: _.store });
    // Make true store (as a model)
    _.store = _0(_.store.Store.insert());
    for (const Model of Object.values(Models)) {
        Model.store0 = _.store;
        Model.store = _.store._2;
        _.store._2[Model.name] = Model;
    }
    Object.assign(_.store, { Models, storeReady: true });
    return _.store._2;
}
