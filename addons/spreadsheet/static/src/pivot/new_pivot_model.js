/** @odoo-module */

import { _t } from "@web/core/l10n/translation";
import { sprintf } from "@web/core/utils/strings";

import { FORMATS } from "../helpers/constants";
import * as fields from "../helpers/fields_helpers";

import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";

const { toString, toNumber, toBoolean } = spreadsheet.helpers;

const BOOLEAN_ORDER = [true, false, undefined];

/**
 * TODOPRO Check to move types in a separate file
 * TODOPRO Check to move helpers in a separate file
 * TODOPRO There is an error with filters, check the Partner Spreadsheet Test
 * TODOPRO Change groupBy from an array of string to an array of Fields
 */

/**
 * @typedef {import("@spreadsheet/pivot/pivot_table").Row} Row
 * @typedef {import("@spreadsheet/pivot/pivot_table").Column} Column
 * @typedef {import("@spreadsheet/helpers/fields_helpers").Field} Field
 *
 * @typedef {Object} PivotMetaData
 * @property {Array<string>} colGroupBys
 * @property {Array<string>} rowGroupBys
 * @property {Array<string>} activeMeasures
 * @property {string} resModel
 * @property {Record<string, Field>} fields
 * @property {string|undefined} modelLabel
 *
 * @typedef {Object} PivotSearchParams
 * @property {Array<string>} groupBy
 * @property {Array<string>} orderBy
 * @property {Object} domain
 * @property {Object} context
 *
 * @typedef {Object} PivotModelParams
 * @property {PivotMetaData} metaData
 * @property {PivotSearchParams} searchParams
 *
 * @typedef {Object} PivotModelServices
 * @property {import("@spreadsheet/data/data_service").SpreadsheetServerDataService} serverData
 * @property {import("@web/core/orm_service").ORM} orm
 *
 * @typedef {string|number|boolean} ReadGroupValue //TODOPRO Check that we cannot have another return type. Perhaps undefined ?
 * @typedef {Record<string, [number, ReadGroupValue]|ReadGroupValue>} Aggregate
 * @typedef {Array<Aggregate>} ReadGroupResult
 *
 * @typedef {Object} PivotNode
 * @property {ReadGroupValue|"ROOT"} value
 * @property {string|"ROOT"} groupBy
 * @property {Array<PivotNode>} [children]
 *
 * @typedef {Object} PivotGroupField
 * @property {Field} field
 * @property {string} groupBy
 * @property {string} [aggregateOperator]
 * @property {boolean} isPositional
 *
 */

/**
 * Parses the positional char (#), the field and operator string of pivot group.
 * e.g. "create_date:month"
 * @param {Record<string, Field>} allFields
 * @param {string} groupFieldString
 * @returns {PivotGroupField}
 */
function parseGroupField(allFields, groupFieldString) {
    let [fieldName, aggregateOperator] = groupFieldString.split(":");
    const isPositional = fieldName.startsWith("#");
    fieldName = isPositional ? fieldName.substring(1) : fieldName;
    const field = allFields[fieldName];
    if (field === undefined) {
        throw new Error(sprintf(_t("Field %s does not exist"), fieldName));
    }
    if (fields.isDate(field)) {
        aggregateOperator = aggregateOperator || "month";
    }
    return {
        isPositional,
        field,
        aggregateOperator,
        groupBy: aggregateOperator ? `${fieldName}:${aggregateOperator}` : fieldName,
    };
}

export const NO_RECORD_AT_THIS_POSITION = Symbol("NO_RECORD_AT_THIS_POSITION");
//TODOPRO With property fields, should we consider inverse this logic, to have a list of supported fields?
const UNSUPPORTED_FIELD_TYPES = ["one2many", "binary", "html"];

function assertFieldIsSupported(field) {
    if (UNSUPPORTED_FIELD_TYPES.includes(field.type)) {
        throwUnsupportedFieldError(field);
    }
}

/**
 *
 * @param {Field} field
 */
function throwUnsupportedFieldError(field) {
    throw new Error(
        sprintf(_t("Field %s is not supported because of its type (%s)"), field.string, field.type)
    );
}

/**
 * Returns the intersection of two arrays. The two arrays must be sorted.
 * The intersection is computed using a binary search.
 * @param {Array} array1
 * @param {Array} array2
 * @returns {Array}
 * //TODOPRO Check if we can use a Set instead
 */
function intersection(array1, array2) {
    return array1.filter((value) => binarySearch(array2, value));
}

/**
 * Check if the array contains a given value using
 * a binary search.
 *
 * ** The array must be sorted! **
 *
 * @param {Array} sortedArray
 * @param {any} value
 * @returns {boolean}
 */
function binarySearch(sortedArray, value) {
    let start = 0;
    let end = sortedArray.length - 1;
    while (start <= end) {
        const mid = Math.floor((start + end) / 2);
        if (sortedArray[mid] === value) {
            return true;
        } else if (sortedArray[mid] < value) {
            start = mid + 1;
        } else {
            end = mid - 1;
        }
    }
    return false;
}

/**
 * Get the value of a field in a readGroup result.
 * A read group value can be a simple value or an array of two elements.
 * In that case, the first element is an id, the second is the label. This
 * function will return the id.
 * If it's a simple value, it will return the value itself except if it's a
 * date or datetime field. In that case, it will return the formatted date.
 * (not localized)
 *
 * @param {Aggregate} aggregate
 * @param {PivotGroupField} groupField
 *
 * @returns {ReadGroupValue}
 */
function extractValueFromReadGroupRequest(aggregate, groupField) {
    const { field, aggregateOperator, groupBy } = groupField;
    const value = aggregate[groupBy];
    if (Array.isArray(value)) {
        return value[0];
    }
    if (fields.isDate(field)) {
        //TODOPRO Check if we could do it directly from getDateStartingDay, instead of exporting from luxon, then create a moment then export if the date is valid.
        const dateValue = getDateStartingDay(aggregate, field, aggregateOperator);
        if (!dateValue) {
            return false;
        }
        const fOut = FORMATS[aggregateOperator]["out"];
        //TODOPRO Replace this with luxon
        const date = moment(dateValue);
        return date.isValid() ? date.format(fOut) : false;
    }
    return value;
}

/**
 * This function returns the starting day of a date or datetime field.
 * (local to the timezone)
 *
 * @param {Aggregate} aggregate
 * @param {Field} field
 * @param {string} aggregateOperator
 *
 * @returns {string | undefined}
 */
function getDateStartingDay(aggregate, field, aggregateOperator) {
    const fieldNameWithAggregate = `${field.name}:${aggregateOperator}`;
    if (!aggregate["__range"] || !aggregate["__range"][fieldNameWithAggregate]) {
        //TODOPRO Check if we could throw an error here
        return undefined;
    }
    const sqlValue = aggregate["__range"][fieldNameWithAggregate].from;
    if (field.type === "date") {
        return sqlValue;
    }
    return luxon.DateTime.fromSQL(sqlValue, { zone: "utc" }).toLocal().toISODate();
}

/**
 * Parses the value defining a pivot group in a PIVOT formula
 * e.g. given the following formula PIVOT("1", "stage_id", "42", "status", "won"),
 * the two group values are "42" and "won".
 * @param {object} field
 * @param {number | boolean | string} groupValue
 * @returns {number | boolean | string}
 */
export function parsePivotFormulaFieldValue(field, groupValue) {
    assertFieldIsSupported(field);
    const groupValueString =
        typeof groupValue === "boolean"
            ? toString(groupValue).toLocaleLowerCase()
            : toString(groupValue);
    // represents a field which is not set (=False server side)
    if (groupValueString === "false") {
        return false;
    }
    switch (field.type) {
        case "datetime":
        case "date":
            return toString(groupValueString);
        case "selection":
        case "char":
        case "text":
            return toString(groupValueString);
        case "boolean":
            return toBoolean(groupValueString);
        case "float":
        case "integer":
        case "monetary":
        case "many2one":
        case "many2many":
            return toNumber(groupValueString);
        default:
            throwUnsupportedFieldError(field);
    }
}


export class SpreadsheetPivotModel2 {
    /**
     * TODOPRO Should update theses parameters to only give what is needed.
     * @param {Object} env
     * @param {PivotModelParams} params
     * @param {PivotModelServices} services
     */
    constructor(env, params, services) {
        this.setup(params, services);
    }

    /**
     * @param {PivotModelParams} params
     * @param {PivotModelServices} services
     */
    setup(params, services) {
        this._metaData = {
            ...params.metaData,
            colGroupBys: params.metaData.colGroupBys.map((gb) =>
                parseGroupField(params.metaData.fields, gb)
            ),
            rowGroupBys: params.metaData.rowGroupBys.map((gb) =>
                parseGroupField(params.metaData.fields, gb)
            ),
        };
        this._searchParams = params.searchParams;
        this._serverData = services.serverData;

        this.aggregates = [];
        // Used for performance reasons
        this.aggregateIds = [];
        this.aggregateMapping = {};
        this.orderedValues = {};
        this._tableStructure = undefined;
    }

    /**
     * @returns {Array<PivotGroupField>}
     */
    get groupBys() {
        return this._metaData.colGroupBys.concat(this._metaData.rowGroupBys);
    }

    getTableStructure() {
        return this._tableStructure?.();
    }

    /**
     * PRIVATE
     */

    /**
     * Execute the read group RPC and return the result.
     * The strategy is to execute only one read group RPC with all the group
     * bys. The result is then processed to extract the data for each group by.
     * This is done to avoid executing one RPC per group by.
     * There is one limitation with this strategy: we have to execute one
     * search read RPC per group (for M2O fields) to get the
     * default order of the group.
     *
     * However, search read RPCs are generally faster/lighter than read group RPCs.
     *
     * @private
     * @returns {Promise<ReadGroupResult>}
     */
    async _readGroup() {
        const { activeMeasures, resModel } = this._metaData;
        const { domain, context } = this._searchParams;
        const kwargs = { lazy: false, context };
        return this._serverData.orm.readGroup(
            resModel,
            domain,
            activeMeasures,
            this.groupBys.map((groupField) => groupField.groupBy),
            kwargs
        );
    }

    /**
     * Reset the data structure. This is done before loading the data.
     * //TODOPRO Not sure it's needed
     *
     * @private
     */
    _initializeDataStructure() {
        this.aggregateMapping = {};
        for (const gb of this.groupBys) {
            this.aggregateMapping[gb.groupBy] = {};
        }
    }

    async load() {
        if (this.groupBys.some((gb) => fields.isMany2Many(gb.field))) {
            console.log("Should load with full RPC");
        }
        this._initializeDataStructure();
        const requests = await this._readGroup();
        this.aggregates = requests;
        this.aggregateIds = Array(requests.length)
            .fill(0)
            .map((_, index) => toString(index));
        for (const index in requests) {
            const request = requests[index];
            for (const gb of this.groupBys) {
                const groupBy = gb.groupBy;
                const value = extractValueFromReadGroupRequest(request, gb);
                if (!(toString(value) in this.aggregateMapping[groupBy])) {
                    this.aggregateMapping[groupBy][toString(value)] = [];
                }
                this.aggregateMapping[groupBy][toString(value)].push(index);
            }
        }
        for (const gb of this.groupBys) {
            const values = Object.keys(this.aggregateMapping[gb.groupBy]);
            await this._orderGroupByValues(gb, values);
        }
        const cols = this._createGroupTree(this._metaData.colGroupBys);
        const rows = this._createGroupTree(this._metaData.rowGroupBys);
        console.log(cols);
        console.log(rows);
        debugger;
        // this._tableStructure = lazy(() => {
        //     // Create cols and rows trees
        // });
        // console.log(this.getTableStructure());
    }

    _createGroupTree(groupBys) {
        const groupTree = new GroupByTree();
        this._computeChildren(groupTree, groupBys, this.aggregateIds);
        return groupTree;
    }

    /**
     *
     * @param {Node} parent
     * @param {Array<string>} groupBys
     * @param {Array<string>} requestIds To be used with intersection
     *
     * @private
     */
    _computeChildren(parent, groupBys, requestIds) {
        if (groupBys.length === 0) {
            return;
        }
        const { groupBy } = groupBys[0];
        for (const value of this.orderedValues[groupBy]) {
            const ids = this.aggregateMapping[groupBy][toString(value)];
            const intersection = requestIds.filter((id) => ids.includes(id));
            if (ids && intersection.length > 0) {
                const child = new Node(value, groupBy);
                parent.add(child);
                this._computeChildren(child, groupBys.slice(1), intersection);
            }
        }
    }

    /**
     * Order the values of a group by which is a date/datetime field.
     * The order is ASC. Dates can contains false value if the record
     * has no value for the field.
     *
     * @param {string} groupBy
     * @param {string} aggregateOperator
     * @param {Array<string>} dates
     *
     * @private
     */
    _orderDateField(groupBy, aggregateOperator, dates) {
        //TODOPRO Use luxon instead of moment
        this.orderedValues[groupBy] = dates
            .filter((value) => value !== "FALSE")
            .map((value) => moment(value, FORMATS[aggregateOperator].out))
            .sort((a, b) => a - b)
            .map((value) => value.format(FORMATS[aggregateOperator].out));
    }

    /**
     *
     * @param {Field} field
     * @param {Array<number, NaN>} values
     */
    _orderNumericField(field, values) {
        //TODOPRO Explain why we need to use the initial domain
        //TODOPRO Why we cannot sort by number order ? Let's test it
        this.orderedValues[field.name] = values.sort((a, b) => a - b);
    }

    /**
     *
     * @param {Field} field
     * @param {Array<string|undefined>} values
     */
    _orderStringField(field, values) {
        this.orderedValues[field.name] = values.filter((x) => x !== "FALSE").sort();
    }

    /**
     * Order the values of a group by.
     *
     * @param {PivotGroupField} fieldGroup
     * @private
     */
    async _orderGroupByValues(fieldGroup, values) {
        const { field, aggregateOperator, groupBy } = fieldGroup;

        switch (field.type) {
            case "datetime":
            case "date":
                //TODOPRO Not sure it's really needed, we could sort it on demand
                this._orderDateField(groupBy, aggregateOperator, values);
                break;
            case "selection":
            case "char":
            case "text":
                this.orderedValues[groupBy] = values.filter((x) => x !== "FALSE").sort();
                break;
            case "boolean":
                this.orderedValues[groupBy] = BOOLEAN_ORDER;
                break;
            case "float":
            case "integer":
            case "monetary":
                this._orderNumericField(field, values.map((value) => parseInt(value, 10)));
                break;
            case "many2one":
            case "many2many":
                const ids = values.map((value) => parseInt(value, 10));
                this.orderedValues[groupBy] = await RelationalField.sort(field, ids, this._serverData.orm);
                break;
            default:
                throwUnsupportedFieldError(field);
        }
    }

    //TODOPRO Change this fucking domain representation
    getRequestsIndexes(domain) {
        let indexes = this.aggregateIds;
        for (let i = 0; i < domain.length; i += 2) {
            const fieldName = domain[i];
            //TODOPRO We should simplify this, and integrate it in the new domain representation
            const { field } = parseGroupField(this._metaData.fields, fieldName);
            const value = toString(parsePivotFormulaFieldValue(field, domain[i + 1]));
            //TODOPRO I assume here that the domain is valid and exist in the data
            const groupBysIndexes = this.aggregateMapping[field.name][value];
            if (!groupBysIndexes) {
                return [];
            }
            indexes = intersection(indexes, groupBysIndexes);
        }
        return indexes;
    }

    _convertPositionalDomain(domain) {
        //TODOPRO
        return domain;
    }

    getPivotCellValue(measure, domain) {
        domain = this._convertPositionalDomain(domain);
        const indexes = this.getRequestsIndexes(domain);
        if (indexes.length === 0) {
            return "";
        }
        //TODOPRO Here the measure is not checked
        const values = indexes.map((index) => this.aggregates[index][measure]);
        //TODOPRO This only works for sum
        return values.reduce((acc, value) => acc + value, 0);
    }
}

class GroupByManager {

}

class AbstractGroupBy {
    constructor(groupBy, allFields) {
        this._data = [];
        this._orderedValues = [];
    }
}

class RelationalField {
    /**
     * Order the values of a group by which is a relation field.
     * The order is the default order of the relation field. This is done
     * by executing a search read RPC.
     * Ids can be NaN if the relation of a record is empty.
     *
     * @param {Field} field Relation field
     * @param {Array<number|NaN>} ids
     *
     * @returns {Promise<Array<number|false>}
     */
    static async sort(field, ids, orm) {
        if (!field.relation) {
            throw new Error("Field is not a relation field");
        }
        /** @type {Array<number|false>} */
        const orderedIds = [];
        const result = await orm.searchRead(
            field.relation,
            [["id", "in", ids]],
            ["id"]
        );
        for (const record of result) {
            orderedIds.push(record.id);
        }
        if (ids.some((id) => isNaN(id))) {
            //TODOPRO Not sure it's really needed. If it's not needed, update the docstring accordingly
            orderedIds.push(false);
        }
        return orderedIds;
    }
}

class Node {
    constructor(value, groupBy) {
        this.value = value;
        this.groupBy = groupBy;
        this.children = [];
    }

    /**
     * @param {Node} node
     */
    add(node) {
        this.children.push(node);
    }
}

class GroupByTree {

    constructor() {
        this.root = new Node("ROOT", "ROOT");
    }

    /**
     * @param {Node} node
     */
    add(node) {
        this.root.add(node);
    }
}