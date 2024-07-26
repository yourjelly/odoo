/** @odoo-module **/

import { Model } from "@web/views/model";
import { session } from "@web/session";
import { formatDateTime, parseDate, parseDateTime } from "@web/core/l10n/dates";
import { KeepLast } from "@web/core/utils/concurrency";

const DATE_GROUP_FORMATS = {
    year: "yyyy",
    quarter: "'Q'q yyyy",
    month: "MMMM yyyy",
    week: "'W'WW yyyy",
    day: "dd MMM yyyy",
};

export class MapModel extends Model {
    setup(params, { notification, http }) {
        this.notification = notification;
        this.http = http;

        this.metaData = {
            ...params,
            mapBoxToken: session.map_box_token || "",
        };

        this.data = {
            count: 0,
            fetchingCoordinates: false,
            groupByKey: false,
            isGrouped: false,
            numberOfLocatedRecords: 0,
            partnerIds: [],
            partners: [],
            partnerToCache: [],
            recordGroups: [],
            records: [],
            routes: [],
            routingError: null,
            shouldUpdatePosition: true,
            useMapBoxAPI: !!this.metaData.mapBoxToken,
        };

        this.coordinateFetchingTimeoutHandle = undefined;
        this.shouldFetchCoordinates = false;
        this.keepLast = new KeepLast();
    }
    /**
     * @param {any} params
     * @returns {Promise<void>}
     */
    async load(params) {
        const metaData = {
            ...this.metaData,
            ...params,
        };
        metaData.groupBy = ['partner_id'];
        this.data = await this._fetchData(metaData);
        this.metaData = metaData;

        this.notify();
    }

    //----------------------------------------------------------------------
    // Protected
    //----------------------------------------------------------------------

    /**
     * Adds the corresponding partner to a record.
     *
     * @protected
     */
    _addPartnerToRecord(metaData, data) {
        for (const record of data.records) {
            for (const partner of data.partners) {
                let recordPartnerId;
                if (metaData.resModel === "res.partner" && metaData.resPartnerField === "id") {
                    recordPartnerId = record.id;
                } else {
                    recordPartnerId = record[metaData.resPartnerField][0];
                }

                if (recordPartnerId == partner.id) {
                    record.partner = partner;
                    data.numberOfLocatedRecords++;
                }
            }
        }
    }


    /**
     * Handles the case of an empty map.
     * Handles the case where the model is res_partner.
     * Fetches the records according to the model given in the arch.
     * If the records has no partner_id field it is sliced from the array.
     *
     * @protected
     * @params {any} metaData
     * @return {Promise<any>}
     */
    async _fetchData(metaData) {
        const data = {
            count: 0,
            fetchingCoordinates: false,
            groupByKey: metaData.groupBy.length ? metaData.groupBy[0] : false,
            isGrouped: metaData.groupBy.length > 0,
            numberOfLocatedRecords: 0,
            partnerIds: [],
            partners: [],
            partnerToCache: [],
            recordGroups: [],
            records: [],
            routes: [],
            routingError: null,
            shouldUpdatePosition: true,
            useMapBoxAPI: !!metaData.mapBoxToken,
        };

        //case of empty map
        if (!metaData.resPartnerField) {
            data.recordGroups = [];
            data.records = [];
            data.routes = [];
            return this.keepLast.add(Promise.resolve(data));
        }
        const results = await this.keepLast.add(this._fetchRecordData(metaData, data));
        
        const datetimeFields=metaData.fieldNames.filter(name=>metaData.fields[name].type=="datetime");
        for(let record of results.records){
            // convert date fields from UTC to local timezone
            for(const field of datetimeFields){
                if (record[field]) {
                    const dateUTC = luxon.DateTime.fromFormat(
                        record[field],
                        "yyyy-MM-dd HH:mm:ss",
                        { zone: "UTC" }
                    );
                    record[field] = formatDateTime(dateUTC, { format: "yyyy-MM-dd HH:mm:ss" });
                }
            }
        }

        data.records = results.records;
        data.count = results.length;
        if (data.isGrouped) {
            data.recordGroups = await this._getRecordGroups(metaData, data);
        } else {
            data.recordGroups = [];
        }

        data.partnerIds = [];
        if (metaData.resModel === "res.partner" && metaData.resPartnerField === "id") {
            for (const record of data.records) {
                data.partnerIds.push(record.id);
                record.partner_id = [record.id];
            }
        } else {
            this._fillPartnerIds(metaData, data);
        }

        data.partnerIds = [...new Set(data.partnerIds)];
        // await this._partnerFetching(metaData, data);

        return data;
    }

    /**
     * Fetch the records for a given model.
     *
     * @protected
     * @returns {Promise}
     */
    _fetchRecordData(metaData, data) {
        const fields = data.groupByKey
            ? metaData.fieldNames.concat(data.groupByKey.split(":")[0])
            : metaData.fieldNames;
        const orderBy = [];
        if (metaData.defaultOrder) {
            orderBy.push(metaData.defaultOrder.name);
            if (metaData.defaultOrder.asc) {
                orderBy.push("ASC");
            }
        }
        return this.orm.webSearchRead(metaData.resModel, metaData.domain, fields, {
            limit: metaData.limit,
            offset: metaData.offset,
            order: orderBy.join(" "),
            context: metaData.context,
        });
    }

    /**
     * @protected
     * @param {number[]} ids contains the ids from the partners
     * @returns {Promise}
     */
    _fetchRecordsPartner(metaData, data, ids) {
        const domain = [
            ["contact_address_complete", "!=", "False"],
            ["id", "in", ids],
        ];
        const fields = ["contact_address_complete", "partner_latitude", "partner_longitude"];
        return this.orm.searchRead("res.partner", domain, fields);
    }


    /**
     * @protected
     * @param {Object[]} records the records that are going to be filtered
     */
    _fillPartnerIds(metaData, data) {
        for (const record of data.records) {
            if (record[metaData.resPartnerField]) {
                data.partnerIds.push(record[metaData.resPartnerField][0]);
            }
        }
    }


    /**
     * @protected
     * @returns {Object} the fetched records grouped by the groupBy field.
     */
    async _getRecordGroups(metaData, data) {
        const [fieldName, subGroup] = data.groupByKey.split(":");
        const groups = {};
        const idToFetch = {};
        const fieldType = metaData.fields[fieldName].type;
        for (const record of data.records) {
            const value = record[fieldName];
            let id, name;
            if (["date", "datetime"].includes(fieldType) && value) {
                const date = fieldType === "date" ? parseDate(value) : parseDateTime(value);
                id = name = date.toFormat(DATE_GROUP_FORMATS[subGroup]);
            } else if (fieldType === "boolean") {
                id = name = value ? this.env._t("Yes") : this.env._t("No");
            } else {
                id = Array.isArray(value) ? value[0] : value;
                name = Array.isArray(value) ? value[1] : value;
            }

            if (id === false && name === false) {
                id = name = this.env._t("None");
            }

            if (["many2many", "one2many"].includes(fieldType) && value.length) {
                for (const m2mId of value) {
                    idToFetch[m2mId] = undefined;
                }
            } else if (!groups[id]) {
                groups[id] = {
                    name,
                    records: [],
                };
            }
            if (!["many2many", "one2many"].includes(fieldType) || !value.length) {
                groups[id].records.push(record);
            }
        }
        if (["many2many", "one2many"].includes(fieldType)) {
            const m2mList = await this.orm.nameGet(
                metaData.fields[fieldName].relation,
                Object.keys(idToFetch).map(Number)
            );
            for (const [m2mId, m2mName] of m2mList) {
                idToFetch[m2mId] = m2mName;
            }

            for (const record of data.records) {
                for (const m2mId of record[fieldName]) {
                    if (!groups[m2mId]) {
                        groups[m2mId] = {
                            name: idToFetch[m2mId],
                            records: [],
                        };
                    }
                    groups[m2mId].records.push(record);
                }
            }
        }
        return groups;
    }


}

MapModel.services = ["notification", "http"];
MapModel.COORDINATE_FETCH_DELAY = 1000;
