//@ts-check

import { PivotPostProcessLayer, registries, helpers } from "@odoo/o-spreadsheet";
import { OdooPivotDataLayer, OdooPivotRuntimeDefinition } from "./odoo_pivot_data_layer";

const { pivotRegistry, supportedPivotPositionalFormulaRegistry } = registries;
const { toString, areDomainArgsFieldsValid } = helpers;

/**
 * @typedef {import("@odoo/o-spreadsheet").FPayload} FPayload
 * @typedef {import("@odoo/o-spreadsheet").PivotMeasure} PivotMeasure
 * @typedef {import("@odoo/o-spreadsheet").PivotDomain} PivotDomain
 * @typedef {import("@odoo/o-spreadsheet").PivotDimension} PivotDimension
 * @typedef {import("@spreadsheet").WebPivotModelParams} WebPivotModelParams
 * @typedef {import("@spreadsheet").OdooPivot<import("./odoo_pivot_data_layer").OdooPivotRuntimeDefinition>} IPivot
 * @typedef {import("@spreadsheet").OdooFields} OdooFields
 * @typedef {import("@spreadsheet").OdooPivotCoreDefinition} OdooPivotCoreDefinition
 * @typedef {import("@spreadsheet").SortedColumn} SortedColumn
 * @typedef {import("@spreadsheet").OdooGetters} OdooGetters
 */

/**
 * @implements {IPivot}
 */
export class OdooPivot {
    /**
     * @override
     * @param {Object} custom custom model config (see DataSource)
     * @param {Object} params
     * @param {OdooPivotCoreDefinition} params.definition
     * @param {OdooGetters} params.getters
     */
    constructor(custom, params) {
        this.dataLayer = new OdooPivotDataLayer(custom, params);
        this.postProcessLayer = new PivotPostProcessLayer(this.dataLayer);
        /** @type {"ODOO"} */
        this.type = "ODOO";
        this.setup();
    }

    setup() {}

    init(params) {
        this.dataLayer.load(params);
    }

    get definition() {
        return this.dataLayer.definition;
    }

    /**
     * @param {import("@odoo/o-spreadsheet").Maybe<FPayload>[]} args
     *
     * @returns {PivotDomain}
     */
    parseArgsToPivotDomain(args) {
        /** @type {PivotDomain} */
        const domain = [];
        const stringArgs = args.map(toString);
        for (let i = 0; i < stringArgs.length; i += 2) {
            if (stringArgs[i] === "measure") {
                domain.push({ field: stringArgs[i], value: stringArgs[i + 1] });
                continue;
            }
            const { dimensionWithGranularity, isPositional, field } = this.parseGroupField(
                stringArgs[i]
            );
            if (isPositional) {
                const previousDomain = [
                    ...domain,
                    // Need to keep the "#"
                    { field: stringArgs[i], value: stringArgs[i + 1], type: "number" },
                ];
                domain.push({
                    field: dimensionWithGranularity,
                    value: this.getLastPivotGroupValue(previousDomain),
                    type: field.type,
                });
            } else {
                domain.push({
                    field: dimensionWithGranularity,
                    value: stringArgs[i + 1],
                    type: field.type,
                });
            }
        }
        return domain;
    }

    /**
     * @param {import("@odoo/o-spreadsheet").Maybe<FPayload>[]} args
     * @returns {boolean}
     */
    areDomainArgsFieldsValid(args) {
        let dimensions = args
            .filter((_, index) => index % 2 === 0)
            .map(toString)
            .map((arg) =>
                arg === "measure" ? "measure" : this.parseGroupField(arg).dimensionWithGranularity
            );
        if (dimensions.length && dimensions.at(-1) === "measure") {
            dimensions = dimensions.slice(0, -1);
        }
        return areDomainArgsFieldsValid(dimensions, this.definition);
    }

    /**
     * Retrieves the display name of the measure with the given name from the pivot model.
     *
     * @param {string} name - The name of the measure.
     * @return {Object} - An object containing the display name of the measure.
     */
    getPivotMeasureValue(name) {
        this.assertIsValid();
        return {
            value: this.getMeasure(name).displayName,
        };
    }

    /**
     * High level method computing the result of PIVOT.HEADER functions.
     * - regular function 'PIVOT.HEADER(1,"stage_id",2,"user_id",6)'
     * - measure header 'PIVOT.HEADER(1,"stage_id",2,"user_id",6,"measure","expected_revenue")
     * - positional header 'PIVOT.HEADER(1,"#stage_id",1,"#user_id",1)'
     *
     * @param {PivotDomain} domain arguments of the function (except the first one which is the pivot id)
     * @returns {FPayload}
     */
    getPivotHeaderValueAndFormat(domain) {
        return this.dataLayer.getPivotHeaderValueAndFormat(domain);
    }

    /**
     * Get the measure object from its name
     *
     * @param {string} name
     * @returns {PivotMeasure}
     */
    getMeasure(name) {
        return this.definition.getMeasure(name);
    }

    /**
     * @param {PivotDomain} domain
     * @returns {string | number | boolean}
     */
    getLastPivotGroupValue(domain) {
        return this.dataLayer.getLastPivotGroupValue(domain);
    }

    getTableStructure() {
        return this.dataLayer.getTableStructure();
    }

    /**
     * @param {string} measureName
     * @param {PivotDomain} domain
     * @returns {FPayload}
     */
    getPivotCellValueAndFormat(measureName, domain) {
        return this.postProcessLayer.getPivotCellValueAndFormat(measureName, domain);
    }

    //--------------------------------------------------------------------------
    // Odoo specific
    //--------------------------------------------------------------------------

    /**
     * @param {string} groupFieldString
     */
    parseGroupField(groupFieldString) {
        return this.dataLayer.parseGroupField(groupFieldString);
    }

    /**
     * @param {PivotDomain} domain
     */
    getPivotCellDomain(domain) {
        return this.dataLayer.getPivotCellDomain(domain);
    }

    /**
     * @param {PivotDimension} dimension
     * @returns {{ value: string | number | boolean, label: string }[]}
     */
    getPossibleFieldValues(dimension) {
        return this.dataLayer.getPossibleFieldValues(dimension);
    }

    async copyModelWithOriginalDomain() {
        return this.dataLayer.copyModelWithOriginalDomain();
    }

    //--------------------------------------------------------------------------
    // Generic data source methods
    //--------------------------------------------------------------------------

    load(params) {
        return this.dataLayer.load(params);
    }

    loadMetadata() {
        return this.dataLayer.loadMetadata();
    }

    isValid() {
        return this.dataLayer.isValid();
    }

    assertIsValid({ throwOnError } = { throwOnError: true }) {
        return this.dataLayer.assertIsValid({ throwOnError });
    }

    getFields() {
        return this.dataLayer.getFields();
    }

    getComputedDomain() {
        return this.dataLayer.getComputedDomain();
    }

    addDomain(domain) {
        this.dataLayer.addDomain(domain);
    }

    getModelLabel() {
        return this.dataLayer.getModelLabel();
    }
}

const MEASURES_TYPES = ["integer", "float", "monetary"];

pivotRegistry.add("ODOO", {
    ui: OdooPivot,
    definition: OdooPivotRuntimeDefinition,
    externalData: true,
    onIterationEndEvaluation: () => {},
    granularities: [
        "year",
        "quarter_number",
        "quarter",
        "month_number",
        "month",
        "iso_week_number",
        "week",
        "day_of_month",
        "day",
    ],
    isMeasureCandidate: (field) =>
        ((MEASURES_TYPES.includes(field.type) && field.aggregator) || field.type === "many2one") &&
        field.name !== "id" &&
        field.store,
    isGroupable: (field) => field.groupable,
});

supportedPivotPositionalFormulaRegistry.add("ODOO", true);
