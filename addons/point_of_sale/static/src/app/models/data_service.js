import { Reactive } from "@web/core/utils/reactive";
import { createRelatedModels } from "@point_of_sale/app/models/related_models";
import { registry } from "@web/core/registry";
import IndexedDB from "./utils/indexed_db";
import { DataServiceOptions } from "./data_service_options";
const INDEXED_DB_VERSION = 1;

export class PosData extends Reactive {
    static modelToLoad = []; // When empty all models are loaded
    static serviceDependencies = ["orm"];

    constructor() {
        super();
        this.ready = this.setup(...arguments).then(() => this);
    }

    async setup(env, { orm }) {
        this.orm = orm;
        this.relations = [];
        this.custom = {};
        this.opts = new DataServiceOptions();

        this.network = {
            offline: false,
            loading: true,
            lastSync: Date.now(),
        };

        this.initIndexedDB();
        await this.initData();

        this.oldData = Object.fromEntries(
            Object.keys(this.records).map((modelName) => [
                modelName,
                Object.fromEntries(
                    Object.keys(this.records[modelName]).map((id) => [
                        id,
                        this.records[modelName][id].serialize(),
                    ])
                ),
            ])
        );
        setInterval(async () => {
            if (!this.network.loading && this.network.lastSync + 3000 < Date.now()) {
                // await this.writeToDB();
                await this.sync();
            }
        }, 3000);

        // effect(
        //     batched((records) => {
        //         this.syncDataWithIndexedDB(records);
        //         // for (const model of ["pos.order", "pos.order.line", "pos.payment"]) {
        //         for (const model of ["pos.order"]) {
        //             // this.create(
        //             //     model.name,
        //             //     Object.keys(this.records[model.name]).filter((id) => typeof id === "string")
        //             // );
        //             Object.keys(this.records[model])
        //                 .filter((id) => typeof id === "string")
        //                 .forEach((id) => {
        //                     this.create(model, [this.records[model][id].serialize({ orm: true })]);
        //                 });
        //         }
        //     }),
        //     [this.records]
        // );
    }

    async sync() {
        this.network.loading = true;
        const toWrite = [];
        const toCreate = [];
        // for (const model of Object.keys(this.records)) {
        for (const model of ["pos.order"]) {
            for (const id of Object.entries(this.records[model]).map(([_, o]) => o.id)) {
                const record = this.records[model][id].serialize({ orm: true });
                if (typeof id == "string") {
                    toCreate.push({ model, id, record });
                    continue;
                }
                for (const field of Object.keys(record)) {
                    if (record[field] !== this.oldData[model][id][field]) {
                        console.log(
                            `Model ${model} with id ${id} changed: ${field} from ${this.oldData[model][id][field]} to ${record[field]}`
                        );
                        toWrite.push({ model, id, field, value: record[field] });
                    }
                    // FIXME only do this if the call to the backend worked
                    this.oldData[model][id][field] = record[field];
                }
            }
        }
        try {
            const res = await this.orm.call("pos.config", "sync", [
                [odoo.pos_config_id],
                toCreate,
                toWrite,
            ]);
            console.log("Synced", res);
            this.network.lastSync = Date.now();
        } finally {
            this.network.loading = false;
        }
    }
    async writeToDB() {
        for (const model of ["pos.order"]) {
            Object.keys(this.records[model])
                .filter((id) => typeof id === "string")
                .forEach(async (id) => {
                    console.log("Syncing data", model, id);
                    const serverId = await this.orm.create(model, [
                        this.records[model][id].serialize({ orm: true }),
                    ]);
                    this.records[model][serverId] = this.records[model][id];
                    this.oldData[model][serverId] = this.records[model][id].serialize({
                        orm: true,
                    });
                    delete this.records[model][id];
                });
        }
    }

    async resetIndexedDB() {
        await this.indexedDB.reset();
    }

    get databaseName() {
        return `config-id_${odoo.pos_config_id}_${odoo.access_token}`;
    }

    initIndexedDB() {
        // In web tests info is not defined
        const models = this.opts.databaseTable.map((m) => {
            return [m.key, m.name];
        });
        this.indexedDB = new IndexedDB(this.databaseName, INDEXED_DB_VERSION, models);
    }

    deleteDataIndexedDB(model, uuid) {
        this.indexedDB.delete(model, [{ uuid }]);
    }

    syncDataWithIndexedDB(records) {
        // Will separate records to remove from indexedDB and records to add
        const dataSorter = (records, isFinalized, key) => {
            return records.reduce(
                (acc, record) => {
                    const finalizedState = isFinalized(record);

                    if (finalizedState === undefined || finalizedState === true) {
                        if (record[key]) {
                            acc.remove.push(record[key]);
                        }
                    } else {
                        acc.put.push(dataFormatter(record));
                    }

                    return acc;
                },
                { put: [], remove: [] }
            );
        };

        // This methods will add uiState to the serialized object
        const dataFormatter = (record) => {
            const serializedData = record.serialize();
            const uiState = typeof record.uiState === "object" ? record.serializeState() : "{}";
            return { ...serializedData, JSONuiState: JSON.stringify(uiState), id: record.id };
        };

        for (const model of this.opts.databaseTable) {
            const nbrRecords = Object.values(records[model.name]).length;

            if (!nbrRecords) {
                continue;
            }

            const data = dataSorter(this.models[model.name].getAll(), model.condition, model.key);
            this.indexedDB.create(model.name, data.put);
            this.indexedDB.delete(model.name, data.remove);
        }

        this.indexedDB.readAll(this.opts.databaseTable.map((db) => db.name)).then((data) => {
            if (!data) {
                return;
            }

            for (const [model, records] of Object.entries(data)) {
                const key = this.opts.databaseTable.find((db) => db.name === model).key;
                for (const record of records) {
                    const localRecord = this.models[model].get(record.id);

                    if (!localRecord) {
                        this.indexedDB.delete(model, [record[key]]);
                    }
                }
            }
        });
    }

    async loadIndexedDBData() {
        const data = await this.indexedDB.readAll();

        if (!data) {
            return;
        }

        const newData = {};
        for (const model of this.opts.databaseTable) {
            const rawRec = data[model.name];

            if (rawRec) {
                newData[model.name] = rawRec.filter((r) => !this.models[model.name].get(r.id));
            }
        }

        if (data["product.product"]) {
            data["product.product"] = data["product.product"].filter(
                (p) => !this.models["product.product"].get(p.id)
            );
        }

        const results = this.models.loadData(data, [], true);
        for (const [model, data] of Object.entries(results)) {
            for (const record of data) {
                if (record.raw.JSONuiState) {
                    const loadedRecords = this.models[model].find((r) => r.uuid === record.uuid);

                    if (loadedRecords) {
                        loadedRecords.setupState(JSON.parse(record.raw.JSONuiState));
                    }
                }
            }
        }

        return results;
    }

    async loadInitialData() {
        return await this.orm.call("pos.session", "load_data", [
            odoo.pos_session_id,
            PosData.modelToLoad,
        ]);
    }
    async initData() {
        const modelClasses = {};
        const relations = {};
        const fields = {};
        const data = {};
        const response = await this.loadInitialData();

        for (const [model, values] of Object.entries(response)) {
            relations[model] = values.relations;
            fields[model] = values.fields;
            data[model] = values.data;
        }

        for (const posModel of registry.category("pos_available_models").getAll()) {
            const pythonModel = posModel.pythonModel;
            const extraFields = posModel.extraFields || {};

            modelClasses[pythonModel] = posModel;
            relations[pythonModel] = {
                ...relations[pythonModel],
                ...extraFields,
            };
        }

        const { models, records, indexedRecords } = createRelatedModels(
            relations,
            modelClasses,
            this.opts.databaseIndex
        );

        this.records = records;
        this.indexedRecords = indexedRecords;
        this.fields = fields;
        this.relations = relations;
        this.models = models;

        const order = data["pos.order"] || [];
        const orderlines = data["pos.order.line"] || [];

        delete data["pos.order"];
        delete data["pos.order.line"];

        this.models.loadData(data, this.modelToLoad);
        this.models.loadData({ "pos.order": order, "pos.order.line": orderlines });
        const dbData = await this.loadIndexedDBData();
        this.loadedIndexedDBProducts = dbData ? dbData["product.product"] : [];
        this.network.loading = false;
    }

    async execute({
        type,
        model,
        ids,
        values,
        method,
        queue,
        args = [],
        kwargs = {},
        fields = [],
        options = [],
        uuid = "",
    }) {
        this.network.loading = true;

        try {
            let result = true;
            let limitedFields = false;
            if (fields.length === 0) {
                fields = this.fields[model] || [];
            }

            if (
                this.fields[model] &&
                fields.sort().join(",") !== this.fields[model].sort().join(",")
            ) {
                limitedFields = true;
            }

            switch (type) {
                case "write":
                    result = await this.orm.write(model, ids, values);
                    break;
                case "delete":
                    result = await this.orm.unlink(model, ids);
                    break;
                case "call":
                    result = await this.orm.call(model, method, args, kwargs);
                    break;
                case "read":
                    queue = false;
                    result = await this.orm.read(model, ids, fields, {
                        ...options,
                        load: false,
                    });
                    break;
                case "search_read":
                    queue = false;
                    result = await this.orm.searchRead(model, args, fields, {
                        ...options,
                        load: false,
                    });
            }

            if (type === "create") {
                const response = await this.orm.create(model, values);
                values[0].id = response[0];
                result = values;
            }

            if (limitedFields) {
                const X2MANY_TYPES = new Set(["many2many", "one2many"]);
                const nonExistentRecords = [];

                for (const record of result) {
                    const localRecord = this.models[model].get(record.id);

                    if (localRecord) {
                        const formattedForUpdate = {};
                        for (const [field, value] of Object.entries(record)) {
                            const fieldsParams = this.relations[model][field];

                            if (!fieldsParams) {
                                console.info("Warning, attempt to load a non-existent field.");
                                continue;
                            }

                            if (X2MANY_TYPES.has(fieldsParams.type)) {
                                formattedForUpdate[field] = value
                                    .filter((id) => this.models[fieldsParams.relation].get(id))
                                    .map((id) => [
                                        "link",
                                        this.models[fieldsParams.relation].get(id),
                                    ]);
                            } else if (fieldsParams.type === "many2one") {
                                if (this.models[fieldsParams.relation].get(value)) {
                                    formattedForUpdate[field] = [
                                        "link",
                                        this.models[fieldsParams.relation].get(value),
                                    ];
                                }
                            } else {
                                formattedForUpdate[field] = value;
                            }
                        }
                        localRecord.update(formattedForUpdate);
                    } else {
                        nonExistentRecords.push(record);
                    }
                }

                if (nonExistentRecords.length) {
                    console.warn(
                        "Warning, attempt to load a non-existent record with limited fields."
                    );
                    result = nonExistentRecords;
                }
            }

            if (this.models[model] && this.opts.autoLoadedOrmMethods.includes(type)) {
                const data = await this.missingRecursive({ [model]: result });
                const results = this.models.loadData(data);
                result = results[model];
            }

            this.network.offline = false;
            return result;
        } catch (error) {
            this.network.offline = true;
            throw error;
        } finally {
            this.network.loading = false;
        }
    }

    async missingRecursive(recordMap, idsMap = {}, acc = {}) {
        const missingRecords = [];

        for (const [model, records] of Object.entries(recordMap)) {
            if (!acc[model]) {
                acc[model] = records;
            } else {
                acc[model] = acc[model].concat(records);
            }

            if (!this.relations[model]) {
                continue;
            }

            const relations = Object.entries(this.relations[model]).filter(
                ([, rel]) => rel.relation && rel.type && this.models[rel.relation]
            );

            for (const [, rel] of relations) {
                if (this.opts.pohibitedAutoLoadedModels.includes(rel.relation)) {
                    continue;
                }

                const values = records.map((record) => record[rel.name]).flat();
                const missing = values.filter((value) => {
                    if (!value || typeof value !== "number" || idsMap[rel.relation]?.has(value)) {
                        return false;
                    }

                    const record = this.models[rel.relation].get(value);
                    return !record || !record.id;
                });

                if (missing.length > 0) {
                    missingRecords.push([rel.relation, Array.from(new Set(missing))]);
                }
            }
        }

        const newRecordMap = {};
        for (const [model, ids] of missingRecords) {
            if (!idsMap[model]) {
                idsMap[model] = new Set(ids);
            } else {
                idsMap[model] = idsMap[model] = new Set([...idsMap[model], ...ids]);
            }

            const data = await this.orm.read(model, Array.from(ids), this.fields[model], {
                load: false,
            });
            newRecordMap[model] = data;
        }

        if (Object.keys(newRecordMap).length > 0) {
            return await this.missingRecursive(newRecordMap, idsMap, acc);
        } else {
            return acc;
        }
    }

    write(model, ids, vals) {
        const records = [];

        for (const id of ids) {
            const record = this.models[model].get(id);
            delete vals.id;
            record.update(vals);

            const dataToUpdate = {};
            const keysToUpdate = Object.keys(vals);

            for (const key of keysToUpdate) {
                dataToUpdate[key] = vals[key];
            }

            records.push(record);
            this.ormWrite(model, [record.id], dataToUpdate);
        }

        return records;
    }

    delete(model, ids) {
        const deleted = [];
        for (const id of ids) {
            const record = this.models[model].get(id);
            deleted.push(id);
            record.delete();
        }

        this.ormDelete(model, ids);
        return deleted;
    }

    async searchRead(model, domain = [], fields = [], options = {}, queue = false) {
        return await this.execute({
            type: "search_read",
            model,
            args: domain,
            fields,
            options,
            queue,
        });
    }

    async read(model, ids, fields = [], options = [], queue = false) {
        return await this.execute({ type: "read", model, ids, fields, options, queue });
    }

    async call(model, method, args = [], kwargs = {}, queue = false) {
        return await this.execute({ type: "call", model, method, args, kwargs, queue });
    }

    // In a silent call we ignore the error and return false instead
    async silentCall(model, method, args = [], kwargs = {}, queue = false) {
        try {
            return await this.execute({ type: "call", model, method, args, kwargs, queue });
        } catch (e) {
            console.warn("Silent call failed:", e);
            return false;
        }
    }

    async callRelated(model, method, args = [], kwargs = {}, queue = true) {
        const data = await this.execute({ type: "call", model, method, args, kwargs, queue });
        const results = this.models.loadData(data, [], true);
        return results;
    }

    async create(model, values, queue = true) {
        return await this.execute({ type: "create", model, values, queue });
    }

    async ormWrite(model, ids, values, queue = true) {
        return await this.execute({ type: "write", model, ids, values, queue });
    }

    async ormDelete(model, ids, queue = true) {
        return await this.execute({ type: "delete", model, ids, queue });
    }

    localDeleteCascade(record, force = false) {
        const recordModel = record.constructor.pythonModel;
        if (typeof record.id === "number" && !force) {
            console.info(
                `Record ID ${record.id} MODEL ${recordModel}. If you want to delete a record saved on the server, you need to pass the force parameter as true.`
            );
            return;
        }

        const relationsToDelete = Object.values(this.relations[recordModel])
            .filter((rel) => this.opts.cascadeDeleteModels.includes(rel.relation))
            .map((rel) => rel.name);
        const recordsToDelete = Object.entries(record)
            .filter(([idx, values]) => relationsToDelete.includes(idx) && values)
            .map(([idx, values]) => values)
            .flat();

        this.indexedDB.delete(recordModel, [record.uuid]);
        const result = record.delete();
        for (const item of recordsToDelete) {
            this.indexedDB.delete(item.model.modelName, [item.uuid]);
            item.delete();
        }
        return result;
    }
}

export const PosDataService = {
    dependencies: PosData.serviceDependencies,
    async start(env, deps) {
        return new PosData(env, deps).ready;
    },
};

registry.category("services").add("pos_data", PosDataService);
