/* @odoo-module */

import BasicModel from "web.BasicModel";

import { KeepLast, Mutex } from "@web/core/utils/concurrency";
import { Dialog } from "@web/core/dialog/dialog";
import { Domain } from "@web/core/domain";
import { isTruthy } from "@web/core/utils/xml";
import { makeContext } from "@web/core/context";
import { Model } from "@web/views/helpers/model";
import { registry } from "@web/core/registry";

const { xml } = owl;

const preloadedDataRegistry = registry.category("preloadedData");

class WarningDialog extends Dialog {
    setup() {
        super.setup();
        this.title = this.props.title;
    }
}
WarningDialog.bodyTemplate = xml`<t t-esc="props.message"/>`;

/**
 * @param {Object} groupByField
 * @returns {boolean}
 */
export const isAllowedDateField = (groupByField) => {
    return (
        ["date", "datetime"].includes(groupByField.type) &&
        isTruthy(groupByField.attrs.allow_group_range_value)
    );
};

/**
 * @param {any} string
 * @return {OrderTerm[]}
 */
export function stringToOrderBy(string) {
    if (!string) {
        return [];
    }
    return string.split(",").map((order) => {
        const splitOrder = order.trim().split(" ");
        if (splitOrder.length === 2) {
            return {
                name: splitOrder[0],
                asc: splitOrder[1].toLowerCase() === "asc",
            };
        } else {
            return {
                name: splitOrder[0],
                asc: true,
            };
        }
    });
}
/**
 * @param {any} modifier
 * @param {Object} evalContext
 * @returns {boolean}
 */
export function evalDomain(modifier, evalContext) {
    if (Array.isArray(modifier)) {
        modifier = new Domain(modifier).contains(evalContext);
    }
    return !!modifier;
}

/**
 * FIXME: don't know where this function should be:
 *   - on a dataPoint: don't want to make it accessible everywhere (e.g. in Fields)
 *   - on the model: would still be accessible by views + I like the current light API of the model
 *
 * Given a model name and res ids, calls the method "action_archive" or
 * "action_unarchive", and executes the returned action any.
 *
 * @param {string} resModel
 * @param {integer[]} resIds
 * @param {boolean} [unarchive=false] if true, unarchive the records, otherwise archive them
 */
async function archiveOrUnarchiveRecords(model, resModel, resIds, unarchive) {
    const method = unarchive === true ? "action_unarchive" : "action_archive";
    const action = await model.orm.call(resModel, method, [resIds]);
    if (action && Object.keys(action).length !== 0) {
        model.action.doAction(action);
    }
    //todo fge _invalidateCache
}

let nextId = 0;
class DataPoint {
    /**
     * @param {RelationalModel} model
     * @param {Object} [params={}]
     * @param {Object} [state={}]
     */
    constructor(model, params, state = {}) {
        this.id = `datapoint_${nextId++}`;
        this.__legacyHandle = params.handle;

        this.model = model;
        const legDP = model.basicModel.get(params.handle);
        this.resModel = legDP.model;
        this.fields = legDP.fields;
        this.activeFields = {};
        const fieldsInfo = (legDP.fieldsInfo && legDP.fieldsInfo[legDP.viewType]) || {};
        for (const [name, descr] of Object.entries(fieldsInfo)) {
            this.activeFields[name] = descr.__WOWL_FIELD_DESCR__;
        }
        this.fieldNames = Object.keys(this.activeFields);
        this.context = legDP.context;

        this.setup(params, state);
    }

    /**
     * @abstract
     * @param {Object} params
     * @param {Object} state
     */
    setup() {}

    exportState() {
        return {};
    }

    async load() {
        throw new Error("load must be implemented");
    }
}

export class Record extends DataPoint {
    setup(params, state) {
        const legDP = this.model.basicModel.get(params.handle);
        this.resId = legDP.res_id;
        this.resIds = [...legDP.res_ids];

        this._invalidFields = new Set();
        this.preloadedData = null; // TODo
        // this.preloadedDataCaches = {};
        this.selected = false;
        this.isInQuickCreation = params.isInQuickCreation || false;
        this._onChangePromise = Promise.resolve({});
        this._domains = {};

        this.mode = params.mode || (this.resId ? state.mode || "readonly" : "edit");
        this._onWillSwitchMode = params.onRecordWillSwitchMode || (() => {});
    }

    get evalContext() {
        const datapoint = this.model.basicModel.localData[this.__legacyHandle];
        return this.model.basicModel._getEvalContext(datapoint);
    }

    get isDirty() {
        return this.model.basicModel.isDirty(this.__legacyHandle);
    }

    /**
     * Since the ORM can support both `active` and `x_active` fields for
     * the archiving mechanism, check if any such field exists and prioritize
     * them. The `active` field should always take priority over its custom
     * version.
     *
     * @returns {boolean} true iff the field is active or there is no `active`
     *   or `x_active` field on the model
     */
    get isActive() {
        if ("active" in this.activeFields) {
            return this.data.active;
        } else if ("x_active" in this.activeFields) {
            return this.data.x_active;
        }
        return true;
    }

    get isNew() {
        return this.model.basicModel.isNew(this.__legacyHandle);
    }

    get isInEdition() {
        return this.mode === "edit";
    }

    async switchMode(mode) {
        if (this.mode === mode) {
            return;
        }
        await this._onWillSwitchMode(this, mode);
        if (mode === "readonly") {
            for (const fieldName in this.activeFields) {
                if (["one2many", "many2many"].includes(this.fields[fieldName].type)) {
                    const editedRecord = this.data[fieldName] && this.data[fieldName].editedRecord;
                    if (editedRecord) {
                        editedRecord.switchMode("readonly");
                    }
                }
            }
        }
        this.mode = mode;
        this.model.notify();
    }

    /**
     * FIXME: memoize this at some point?
     * @param {string} fieldName
     * @returns {boolean}
     */
    isReadonly(fieldName) {
        const { readonly } = this.activeFields[fieldName].modifiers;
        return evalDomain(readonly, this.evalContext);
    }

    /**
     * FIXME: memoize this at some point?
     * @param {string} fieldName
     * @returns {boolean}
     */
    isRequired(fieldName) {
        const { required } = this.activeFields[fieldName].modifiers;
        return evalDomain(required, this.evalContext);
    }

    setInvalidField(fieldName) {
        this._invalidFields.add({ fieldName });
        this.model.notify();
    }

    isInvalid(fieldName) {
        for (const invalid of this._invalidFields) {
            if (invalid.fieldName === fieldName) return true;
        }
        return false;
    }

    async load() {
        this._invalidFields = new Set();
        const legDP = this.model.basicModel.get(this.__legacyHandle);
        const data = Object.assign({}, legDP.data);
        for (const fieldName of Object.keys(data)) {
            const fieldType = legDP.fields[fieldName].type;
            switch (fieldType) {
                case "date":
                case "datetime":
                    // from moment to luxon
                    if (data[fieldName]) {
                        data[fieldName] = luxon.DateTime.fromISO(data[fieldName].toISOString());
                    }
                    break;
                case "one2many":
                case "many2many":
                    data[fieldName] = new StaticList(this.model, { handle: data[fieldName].id });
                    data[fieldName].load();
                    break;
                case "many2one":
                    data[fieldName] = data[fieldName]
                        ? [data[fieldName].data.id, data[fieldName].data.display_name]
                        : false;
                    break;
            }
        }
        this.data = data;
    }

    exportState() {
        return {
            mode: this.mode,
            resId: this.resId,
            resIds: this.resIds,
        };
    }

    getFieldContext(fieldName) {
        return this.model.basicModel.localData[this.__legacyHandle].getContext({ fieldName });
    }

    getFieldDomain(fieldName) {
        return Domain.and([
            this.model.basicModel.localData[this.__legacyHandle].getDomain({ fieldName }),
        ]);
    }

    // loadPreloadedData() {
    //     const fetchPreloadedData = async (fetchFn, fieldName) => {
    //         const domain = this.getFieldDomain(fieldName).toList(this.evalContext).toString();
    //         if (domain.toString() !== this.preloadedDataCaches[fieldName]) {
    //             this.preloadedDataCaches[fieldName] = domain.toString();
    //             this.preloadedData[fieldName] = await fetchFn(this.model.orm, this, fieldName);
    //         }
    //     };

    //     const proms = [];
    //     for (const fieldName in this.activeFields) {
    //         const activeField = this.activeFields[fieldName];
    //         // @FIXME type should not be get like this
    //         const type = activeField.widget || this.fields[fieldName].type;
    //         if (!activeField.invisible && preloadedDataRegistry.contains(type)) {
    //             proms.push(fetchPreloadedData(preloadedDataRegistry.get(type), fieldName));
    //         }
    //     }
    //     return Promise.all(proms);
    // }

    async update(fieldName, value) {
        const changes = {};
        changes[fieldName] = value;
        switch (this.fields[fieldName].type) {
            case "date":
            case "datetime":
                // from luxon to moment
                changes[fieldName] = changes[fieldName]
                    ? moment(changes[fieldName].toISO())
                    : false;
                break;
            case "many2one":
                changes[fieldName] = changes[fieldName]
                    ? { id: changes[fieldName][0], display_name: changes[fieldName][1] }
                    : false;
                break;
        }
        await this.model.basicModel.notifyChanges(this.__legacyHandle, changes);
        this.load();
        // this._invalidFields.forEach((x) =>
        //     x.fieldName === fieldName ? this._invalidFields.delete(x) : x
        // );
        this.model.notify();
    }

    /**
     *
     * @param {Object} options
     * @param {boolean} [options.stayInEdition=false]
     * @param {boolean} [options.noReload=false] prevents the record from
     *  reloading after changes are applied, typically used to defer the load.
     * @returns {Promise<boolean>}
     */
    async save(options = { stayInEdition: false, noReload: false }) {
        await this.model.basicModel.save(this.__legacyHandle, { reload: !options.noReload });
        this.load();
        this.resId = this.model.basicModel.localData[this.__legacyHandle].res_id || false;
        if (!options.stayInEdition) {
            this.switchMode("readonly");
        }
        this.model.notify();
        return true;
    }

    async archive() {
        await archiveOrUnarchiveRecords(this.model, this.resModel, [this.resId]);
        await this.load();
        this.model.notify();
    }

    async unarchive() {
        await archiveOrUnarchiveRecords(this.model, this.resModel, [this.resId], true);
        await this.load();
        this.model.notify();
    }

    // FIXME AAB: to discuss: not sure we want to keep resIds in the model (this concerns
    // "duplicate" and "delete"). Alternative: handle this in form_view (but then what's the
    // point of calling a Record method to do the operation?)
    async duplicate() {
        this.__legacyHandle = await this.model.basicModel.duplicateRecord(this.__legacyHandle);
        this.resId = this.model.basicModel.localData[this.__legacyHandle].res_id;
        this.load();
        this.switchMode("edit");
        this.model.notify();
    }

    async delete() {
        await this.model.basicModel.deleteRecords([this.__legacyHandle], this.resModel);
        const legDP = this.model.basicModel.localData[this.__legacyHandle];
        this.resId = legDP.res_id;
        this.resIds = [...legDP.res_ids];
        if (this.resIds.length) {
            await this.model.basicModel.reload(this.__legacyHandle);
            this.load();
        }
        this.model.notify();
    }

    toggleSelection(selected) {
        if (typeof selected === "boolean") {
            this.selected = selected;
        } else {
            this.selected = !this.selected;
        }
        this.model.notify();
    }

    discard() {
        this.model.basicModel.discardChanges(this.__legacyHandle);
        this.load();
        if (this.resId) {
            this.switchMode("readonly");
        }
        this.model.notify();
    }
}

export class StaticList extends DataPoint {
    setup(params, state) {
        // this.isOne2Many = params.field.type === "one2many"; // bof

        const legDP = this.model.basicModel.get(params.handle);
        this.resId = legDP.res_id;

        this.resIds = [...legDP.res_ids];
        /** @type {Record[]} */
        this.records = [];

        this.views = legDP.fieldsInfo;
        this.viewMode = legDP.viewType;
        this.orderBy = legDP.orderedBy;
        this.limit = legDP.limit;
        this.offset = legDP.offset;

        // this.validated = {};
        // this.rawContext = params.rawContext;
        // this.getEvalContext = params.getEvalContext;

        this.editedRecord = null;
        this.onRecordWillSwitchMode = async (record, mode) => {
            if (params.onRecordWillSwitchMode) {
                params.onRecordWillSwitchMode(record, mode);
            }
            const editedRecord = this.editedRecord;
            this.editedRecord = null;
            if (editedRecord) {
                await editedRecord.switchMode("readonly");
            }
            if (mode === "edit") {
                this.editedRecord = record;
            }
        };
    }

    delete(record) {
        this.onChanges();
        const { resId } = record;
        // Where do we need to manage resId=false?
        this._commands.push(Commands.delete(record.resId));
        const i = this.resIds.findIndex((id) => id === resId);
        this.resIds.splice(i, 1);
        const j = this.records.findIndex((r) => r.resId === resId);
        this.records.splice(j, 1);
        if (this.editedRecord === record) {
            this.editedRecord = null;
        }
    }

    async add(context) {
        this.onChanges();
        const record = this.model.createDataPoint("record", {
            context: makeContext([this.context, this.rawContext, context], this.getEvalContext()),
            resModel: this.resModel,
            fields: this.fields,
            activeFields: this.activeFields,
            viewMode: this.viewMode,
            views: this.views,
            onRecordWillSwitchMode: this.onRecordWillSwitchMode,
        });
        record._onWillSwitchMode(record, "edit"); // bof
        await record.load();
        this._cache[record.virtualId] = record;
        this.records.push(record);
        this.resIds.push(record.virtualId);
        this.limit = this.limit + 1; // might be not good
        this.validated[record.virtualId] = false;
        this.model.notify();
    }

    addRecord(record) {
        this.onChanges();
        this._cache[record.virtualId] = record;
        this._cache[record.virtualId] = record;
        this.records.push(record);
        this.resIds.push(record.virtualId);
        this.limit = this.limit + 1; // might be not good
        this.validated[record.virtualId] = false;
        this.model.notify();
    }

    exportState() {
        return {
            limit: this.limit,
        };
    }

    get count() {
        return this.model.basicModel.localData[this.__legacyHandle].count;
    }

    async load() {
        const legacyListDP = this.model.basicModel.get(this.__legacyHandle);
        this.records = legacyListDP.data.map((dp) => {
            const record = new Record(this.model, {
                handle: dp.id,
            });
            record.load();
            return record;
        });
    }

    async sortBy(fieldName) {
        await this.model.basicModel.setSort(this.__legacyHandle, fieldName);
        this.load();
        this.model.notify();
    }
}

function mapActiveFieldsToFieldsInfo(activeFields, viewType) {
    const fieldsInfo = {};
    fieldsInfo[viewType] = {};
    for (const [fieldName, fieldDescr] of Object.entries(activeFields)) {
        const views = {};
        for (const [viewType, viewDescr] of Object.entries(fieldDescr.views || {})) {
            views[viewType] = {
                fields: viewDescr.fields,
                type: viewType,
                fieldsInfo: mapActiveFieldsToFieldsInfo(viewDescr.activeFields, viewType),
            };
            for (const fieldName in views[viewType].fieldsInfo[viewType]) {
                if (!views[viewType].fields[fieldName]) {
                    views[viewType].fields[fieldName] = {
                        name: fieldName,
                        type: views[viewType].fieldsInfo[viewType][fieldName].type,
                    };
                }
            }
        }
        const fieldInfo = {
            Widget: fieldDescr.FieldComponent,
            context: fieldDescr.context,
            fieldDependencies: {}, // ??
            mode: fieldDescr.viewMode,
            modifiers: fieldDescr.modifiers,
            name: fieldName,
            options: fieldDescr.options,
            views,
            __WOWL_FIELD_DESCR__: fieldDescr,
        };
        if (fieldDescr.onChange) {
            fieldInfo.on_change = "1";
        }
        // TODO: limit
        // TODO: __no_fetch
        // FIXME? FieldWidget in kanban undefined
        fieldsInfo[viewType][fieldName] = fieldInfo;
    }
    return fieldsInfo;
}

export class RelationalModel extends Model {
    setup(params, { action, orm, dialog, notification, rpc, user, view }) {
        this.action = action;
        this.dialogService = dialog;
        this.notificationService = notification;
        this.rpc = rpc;
        this.viewService = view;
        this.orm = orm;
        this.keepLast = new KeepLast();
        this.mutex = new Mutex();

        this.nextVirtualId = 1;

        this.onCreate = params.onCreate;
        this.quickCreateView = params.quickCreateView;
        this.defaultGroupBy = params.defaultGroupBy || false;
        this.defaultOrderBy = params.defaultOrder;
        this.rootType = params.rootType || "list";
        this.rootParams = {
            activeFields: params.activeFields || {},
            fields: params.fields || {},
            viewMode: params.viewMode || null,
            resModel: params.resModel,
            groupByInfo: params.groupByInfo,
        };
        if (this.rootType === "record") {
            this.rootParams.resId = params.resId;
            this.rootParams.resIds = params.resIds;
        } else {
            this.rootParams.openGroupsByDefault = params.openGroupsByDefault || false;
            this.rootParams.limit = params.limit;
            this.rootParams.groupLimit = params.groupLimit;
        }

        // this.db = Object.create(null);
        this.root = null;

        this.basicModel = new BasicModel(this, {
            fields: this.rootParams.fields,
            modelName: this.rootParams.resModel,
            useSampleModel: false, // FIXME AAB
        });
        this.loadParams = {
            type: this.rootType,
            modelName: this.rootParams.resModel,
            res_id: this.rootParams.resId,
            res_ids: this.rootParams.resIds,
            fields: this.rootParams.fields,
            fieldsInfo: mapActiveFieldsToFieldsInfo(this.rootParams.activeFields, "form"),
            viewType: "form",
            limit: this.rootParams.limit,
        };

        // debug
        window.basicmodel = this;
        // console.group("Current model");
        // console.log(this);
        // console.groupEnd();
    }

    /**
     * @param {Object} [params={}]
     * @param {Comparison | null} [params.comparison]
     * @param {Context} [params.context]
     * @param {DomainListRepr} [params.domain]
     * @param {string[]} [params.groupBy]
     * @param {Object[]} [params.orderBy]
     * @param {number} [params.resId] should not be there
     * @returns {Promise<void>}
     */
    async load(params = {}) {
        if ("resId" in params) {
            this.loadParams.res_id = params.resId;
        }
        const handle = await this.basicModel.load({ ...this.loadParams });
        this.root = new Record(this, { handle });
        this.root.load();
        this.notify();
    }

    /**
     * @override
     */
    getGroups() {
        return this.root.groups && this.root.groups.length ? this.root.groups : null;
    }

    _trigger_up(ev) {
        const evType = ev.name;
        const payload = ev.data;
        if (evType === "call_service") {
            let args = payload.args || [];
            if (payload.service === "ajax" && payload.method === "rpc") {
                // ajax service uses an extra 'target' argument for rpc
                args = args.concat(ev.target);
                return payload.callback(owl.Component.env.session.rpc(...args));
            }
            throw new Error(`call service ${payload.service} not handled in relational model`);
        }
        throw new Error(`trigger_up(${evType}) not handled in relational model`);
    }
}

RelationalModel.services = ["action", "orm", "dialog", "notification", "rpc", "user", "view"];
