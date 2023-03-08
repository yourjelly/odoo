// @odoo-module

import { registry } from "@web/core/registry";
import { DisplayNameRepository } from "../data_sources/display_name_repository";
import { LabelsRepository } from "../data_sources/labels_repository";
import { BatchedCachedRequestMaker } from "./batched_cached_request_maker";

const { EventBus } = owl;

export class SpreadsheetServerDataService extends EventBus {
    /**
     * @param {import("@web/core/orm_service").ORM} orm
     */
    constructor(orm) {
        super();
        /** @private */
        this._orm = orm;

        /** @private */
        this._batchedCachedRequestMaker = new BatchedCachedRequestMaker(this._orm, {
            whenDataIsFetched: () => this.trigger("data-fetched"),
        });

        /** @private */
        this._labelsRepository = new LabelsRepository();

        /** @private */
        this._displayNameRepository = new DisplayNameRepository(this._orm, {
            whenDataIsFetched: () => this.trigger("data-fetched"),
        });
    }

    get labels() {
        return {
            get: this._labelsRepository.getLabel.bind(this._labelsRepository),
            set: this._labelsRepository.setLabel.bind(this._labelsRepository),
        };
    }

    get displayNames() {
        return {
            get: this._displayNameRepository.getDisplayName.bind(this._displayNameRepository),
            set: this._displayNameRepository.setDisplayName.bind(this._displayNameRepository),
        };
    }

    get metaData() {
        return {
            fieldsGet: this._fieldsGet.bind(this),
            modelDisplayName: this._modelDisplayName.bind(this),
        };
    }

    get orm() {
        return this._orm;
    }

    get request() {
        return {
            get: this._batchedCachedRequestMaker.get.bind(this._batchedCachedRequestMaker),
            fetch: this._batchedCachedRequestMaker.fetch.bind(this._batchedCachedRequestMaker),
            batch: {
                get: this._batchedCachedRequestMaker.batch.get.bind(
                    this._batchedCachedRequestMaker
                ),
            },
        };
    }

    /**
     * Get the list of fields for the given model
     *
     * @param {string} model Technical name
     * @private
     * @returns {Promise<Record<string, Field>>} List of fields (result of fields_get)
     */
    async _fieldsGet(model) {
        return this._batchedCachedRequestMaker.fetch(model, "fields_get");
    }

    /**
     * Get the display name of the given model
     *
     * @param {string} model Technical name
     * @private
     * @returns {Promise<string>} Display name of the model
     */
    async _modelDisplayName(model) {
        const result = await this._batchedCachedRequestMaker.fetch("ir.model", "display_name_for", [
            [model],
        ]);
        return (result[0] && result[0].display_name) || "";
    }
}

export const spreadsheetServerDataService = {
    dependencies: ["orm"],
    start(env, { orm }) {
        return new SpreadsheetServerDataService(orm.silent);
    },
};

registry.category("services").add("spreadsheet_server_data", spreadsheetServerDataService);
