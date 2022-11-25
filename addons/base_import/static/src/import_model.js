/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { pick } from "@web/core/utils/objects";
import { groupBy, sortBy } from "@web/core/utils/arrays";
import { sprintf } from "@web/core/utils/strings";
import { isRelational } from "@web/views/utils";
import { reactive } from "@odoo/owl";

/**
 * Assign the new values to the original object and returns it.
 * It allows to set an array or object without loosing its reactivity.
 * @param {Array|Object} originalObj
 * @param {Array|Object} newObj
 * @returns {Array|Object}
 */
function assign(originalObj, newObj) {
    if (Array.isArray(originalObj)) {
        Object.assign(originalObj, newObj, { length: newObj.length });
    } else {
        Object.assign(originalObj, newObj);
    }
    return originalObj;
}

/**
 * -------------------------------------------------------------------------
 * Base Import Business Logic
 * -------------------------------------------------------------------------
 *
 * Handles mapping and updating the preview data of the csv/excel files to be
 * used in the different base_import components.
 *
 * When uploading a file some "preview data" is returned by the backend, this
 * data consist of the different columns of the file and the odoo fields which
 * these columns can be mapped to.
 *
 * Only a small selection of the lines are returned so the user can get an idea
 * of how to correctly map the columns. *(this is why it is refered as "preview
 * data")*
 *
 */
export class BaseImportModel {
    constructor({ env, resModel, context, orm }) {
        this.id = 1;
        this.env = env;
        this.orm = orm;
        this.handleInterruption = false;

        this.resModel = resModel;
        this.parentContext = context || {};

        this.fields = [];
        this.columns = [];
        this.importMessages = [];
        this._importOptions = {};

        this.importTemplates = [];

        this.formattingOptionsValues = this._getCSVFormattingOptions();

        this.importOptionsValues = {
            ...this.formattingOptionsValues,
            advanced: {
                reloadParse: true,
                value: true,
            },
            has_headers: {
                reloadParse: true,
                value: true,
            },
            keep_matches: {
                value: false, // not sure about this: see legacy this.do_not_change_match
            },
            limit: {
                value: 2000,
            },
            sheets: {
                value: [],
            },
            sheet: {
                label: _lt("Selected Sheet:"),
                reloadParse: true,
                value: "",
            },
            skip: {
                value: 0,
            },
            tracking_disable: {
                value: true,
            },
        };

        this.fieldsToHandle = {};
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    get formattingOptions() {
        return pick(this.importOptionsValues, ...Object.keys(this.formattingOptionsValues));
    }

    get importOptions() {
        const tempImportOptions = {
            fallback_values: {},
            name_create_enabled_fields: {},
        };
        for (const [name, option] of Object.entries(this.importOptionsValues)) {
            tempImportOptions[name] = option.value;
        }
        const fieldsToHandle = Object.entries(this.fieldsToHandle);
        if (fieldsToHandle.length) {
            tempImportOptions.import_skip_records = fieldsToHandle.map(([k, v]) =>
                v ? v.optionName === "import_skip_records" && k : []
            );
            tempImportOptions.import_set_empty_fields = fieldsToHandle.map(([k, v]) =>
                v ? v.optionName === "import_set_empty_fields" && k : []
            );
            for (const [k] of fieldsToHandle.filter(
                ([k, v]) => v && v.optionName === "name_create_enabled_fields"
            )) {
                tempImportOptions.name_create_enabled_fields[k] = true;
            }
            for (const [k, v] of fieldsToHandle.filter(
                ([k, v]) => v && v.optionName === "fallback_values"
            )) {
                tempImportOptions.fallback_values[k] = v.value;
            }
        }
        return assign(this._importOptions, tempImportOptions);
    }

    set importOptions(options) {
        for (const key in options) {
            this.importOptionsValues[key].value = options[key];
        }
    }

    async init() {
        if (this.resModel) {
            assign(
                this.importTemplates,
                await this.orm.call(this.resModel, "get_import_templates", [], {
                    context: this.parentContext,
                })
            );
        }
        this.id = await this.orm.call("base_import.import", "create", [
            { res_model: this.resModel },
        ]);
    }

    async executeImport(isTest = false, totalSteps, importProgress) {
        this.handleInterruption = false;
        this._updateComments();
        assign(this.importMessages, []);

        const startRow = this.importOptions.skip;
        const importRes = {
            ids: [],
            fields: this.columns.map((e) => Boolean(e.fieldInfo) && e.fieldInfo.name),
            columns: this.columns.map((e) => e.name.trim().toLowerCase()),
            hasError: false,
        };

        for (let i = 1; i <= totalSteps; i++) {
            if (this.handleInterruption) {
                (importRes.hasError || isTest) && this.setOption("skip", startRow);
                break;
            }

            try {
                await this._executeImportStep(isTest, importRes);
            } catch (error) {
                return { error: error };
            }

            if (importProgress) {
                importProgress.step = i;
                importProgress.value = Math.round((100 * (i - 1)) / totalSteps);
            }
        }

        if (!importRes.hasError) {
            if (importRes.nextrow) {
                this._addMessage("warning", [
                    sprintf(
                        _lt("Click 'Resume' to proceed with the import, resuming at line %s."),
                        importRes.nextrow + 1
                    ),
                    _lt("You can test or reload your file before resuming the import."),
                ]);
            }
            if (isTest) {
                this._addMessage("info", [_lt("Everything seems valid.")]);
            }
        } else {
            importRes.nextrow = startRow;
        }
        return { res: importRes };
    }

    /**
     * Ask the server for the parsing preview
     * and update the data accordingly.
     */
    async updateData() {
        assign(this.importMessages, []);
        try {
            const { res, error } = await this._parsePreview();

            if (!error) {
                this._onLoadSuccess(res);
            } else {
                this._onLoadError();
            }

            return { res, error };
        } catch (error) {
            return { res: {}, error: error.toString() };
        }
    }

    async setOption(optionName, value, fieldName) {
        if (fieldName) {
            this.fieldsToHandle[fieldName] = {
                optionName,
                value,
            };
            return;
        }
        this.importOptionsValues[optionName].value = value;
        if (this.importOptionsValues[optionName].reloadParse) {
            await this.updateData();
        }
    }

    setColumnField(column, fieldInfo) {
        column.fieldInfo = fieldInfo;
        this._updateComments(column);
    }

    isColumnFieldSet(column) {
        return column.fieldInfo != null;
    }

    /*
     * We must wait the current iteration of execute_import to conclude and it
     * will stop at the start of the next batch with handleInterruption
     */
    stopImport() {
        this.handleInterruption = true;
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _addMessage(type, lines) {
        const importMsgs = this.importMessages;
        importMsgs.push({
            type: type.replace("error", "danger"),
            lines,
        });
        assign(this.importMessages, importMsgs);
    }

    async _executeImportStep(isTest, importRes) {
        const { ids, messages, nextrow, name } = await this._callImport(isTest, [
            this.id,
            importRes.fields,
            importRes.columns,
            this.importOptions,
        ]);

        if (ids) {
            importRes.ids = importRes.ids.concat(ids);
        }

        if (messages && messages.length) {
            importRes.hasError = true;
            this.stopImport();

            if (messages[0].not_matching_error) {
                this._addMessage(messages[0].type, [messages[0].message]);
                return false;
            }

            const sortedMessages = this._groupErrorsByField(messages);
            if (sortedMessages[0]) {
                this._addMessage(sortedMessages[0].type, [sortedMessages[0].message]);
                delete sortedMessages[0];
            } else {
                this._addMessage("danger", [_lt("The file contains blocking errors (see below)")]);
            }

            for (const [columnFieldId, errors] of Object.entries(sortedMessages)) {
                // Handle errors regarding specific colums.
                const column = this.columns.find(
                    (e) => e.fieldInfo && e.fieldInfo.id === columnFieldId
                );
                debugger
                if (column) {
                    column.resultNames = name;
                    column.errors = errors;
                } else {
                    for (const error of errors) {
                        // Handle errors regarding specific records.
                        if (error.record !== undefined) {
                            this._addMessage("danger", [
                                sprintf(_lt('Error at row %s: "%s"'), error.record, error.message),
                            ]);
                        }
                        // Handle global errors.
                        else {
                            this._addMessage("danger", [error.message]);
                        }
                    }
                }
            }
        }

        this.setOption("skip", nextrow || 0);
        importRes.nextrow = nextrow;
    }

    async _callImport(dryrun, args) {
        return await this.orm.call("base_import.import", "execute_import", args, {
            dryrun,
            context: {
                ...this.parentContext,
                tracking_disable: this.importOptions.tracking_disable,
            },
        });
    }

    async _parsePreview() {
        const res = await this.orm.call("base_import.import", "parse_preview", [
            this.id,
            this.importOptions,
        ]);
        return { res, error: res.error };
    }

    _groupErrorsByField(messages) {
        const groupedErrors = {};
        const errorsByMessage = groupBy(
            this._sortErrors(messages),
            (f) => ((f.field_path ? f.field_path.join("/") : f.field) && f.message) || "0"
        );
        for (const [message, errors] of Object.entries(errorsByMessage)) {
            if (message === "0") {
                groupedErrors[0] = errors.find((e) => e.record === undefined);
            } else {
                errors[0].rows.to = errors[errors.length - 1].rows.to;
                const fieldId = errors[0].field_path ? errors[0].field_path.join("/") : errors[0].field;
                if (groupedErrors[fieldId]) {
                    groupedErrors[fieldId].push(errors[0]);
                } else {
                    groupedErrors[fieldId] = [errors[0]];
                }
            }
        }
        return groupedErrors;
    }

    _sortErrors(messages) {
        return sortBy(messages, (e) => ["error", "warning", "info"].indexOf(e.priority));
    }

    /**
     * On the preview data succesfuly loaded, update the
     * import options, columns and messages.
     * @param {*} res
     */
    _onLoadSuccess(res) {
        this.fields = res.fields;

        // If in advanced mode, handle subfields as well
        if (this.importOptions.advanced) {
            const subfields = [];
            for (const field of this.fields) {
                if (field.fields && field.fields.length) {
                    for (const subfield of field.fields) {
                        if (subfield.id.split("/").length < 4) {
                            subfield.id = `${field.id}/${subfield.id}`;
                            subfield.name = `${field.name}/${subfield.name}`;
                            subfield.string = `${field.string} / ${subfield.string}`;
                            subfields.push(subfield);
                        }
                    }
                }
            }
            this.fields.push(...subfields);
        }

        // Set options
        for (const key in res.options) {
            if (this.importOptionsValues[key]) {
                this.importOptionsValues[key].value = res.options[key];
            }
        }

        // Set columns
        assign(this.columns, this._getColumns(res));

        // Set import messages
        if (res.headers.length === 1) {
            this._addMessage("warning", [
                _lt(
                    "A single column was found in the file, this often means the file separator is incorrect."
                ),
            ]);
        }
    }

    _onLoadError() {
        assign(this.columns, []);
        assign(this.importMessages, []);
    }

    _getColumns(res) {
        function createColumn(model, id, name, index, previews, preview) {
            const fields = model._getFields(res, index);
            return {
                id,
                name,
                preview,
                previews,
                fields,
                fieldInfo: model._findField(fields, id),
                comments: [],
                errors: [],
            };
        }

        function getId(res, index) {
            return res.matches && index in res.matches && res.matches[index].length > 0
                ? res.matches[index].join("/")
                : undefined;
        }

        if (this.importOptions.has_headers && res.headers && res.preview.length > 0) {
            return res.headers.flatMap((header, index) => {
                return createColumn(
                    this,
                    getId(res, index),
                    header,
                    index,
                    res.preview[index],
                    res.preview[index][0]
                );
            });
        } else if (res.preview && res.preview.length >= 2) {
            return res.preview.flatMap((preview, index) =>
                createColumn(
                    this,
                    preview[0],
                    this.importOptions.has_headers ? preview[0] : preview.join(", "),
                    index,
                    preview,
                    preview[1]
                )
            );
        }
        return [];
    }

    _findField(fields, id) {
        return Object.entries(fields).flatMap(e => e[1]).find((field) => field.name === id);
    }

    /**
     * Sort fields into their respective categories, namely:
     * - Basic => Only the ID field
     * - Suggested => Non-relational fields from the header"s types
     * - Additional => Non-relational fields of any other type
     * - Relational => Relational fields
     * @param {*} res
     */
    _getFields(res, index) {
        const advancedMode = this.importOptions.advanced;
        const acceptedTypes = res.header_types[index];
        const fields = {
            basic: [],
            suggested: [],
            additional: [],
            relational: [],
        };

        function hasType(types, field) {
            return types && types.indexOf(field.type) !== -1;
        }

        function sortSingleField(field, collection, types) {
            // Get field respective category
            if (!collection) {
                if (field.name === "id") {
                    collection = fields.basic;
                } else if (!isRelational(field)) {
                    collection = hasType(types, field) ? fields.suggested : fields.additional;
                } else {
                    collection = fields.relational;
                }
            }

            // Add field to found category
            collection.push(field);
        }

        // Sort fields in their respective categories
        for (const field of this.fields) {
            if (advancedMode) {
                sortSingleField(field, undefined, ["all"]);
            } else {
                sortSingleField(field, undefined, acceptedTypes);
            }
        }
        return fields;
    }

    _updateComments(updatedColumn) {
        for (const column of this.columns) {
            column.comments = [];
            column.errors = [];
            column.resultNames = [];
            column.importOptions = column.fieldInfo && this.fieldsToHandle[column.fieldInfo.id];

            if (!updatedColumn || !column.fieldInfo) {
                continue;
            }

            // Fields of type "char", "text" or "many2many" can be specified multiple
            // times and they will be concatenated, fields of other types must be unique.
            if (["char", "text", "many2many"].includes(column.fieldInfo.type)) {
                if (column.fieldInfo.type === "many2many") {
                    column.comments.push({
                        type: "info",
                        content: _lt("To import multiple values, separate them by a comma."),
                    });
                }

                // If multiple columns are mapped on the same field, inform
                // the user that they will be concatenated.
                const samefieldColumns = this.columns.filter(
                    (col) => col.fieldInfo && col.fieldInfo.id === column.fieldInfo.id
                );
                if (samefieldColumns.length >= 2) {
                    column.comments.push({
                        type: "info",
                        content: sprintf(
                            _lt("This column will be concatenated in field <strong>%s</strong>."),
                            column.fieldInfo.string
                        ),
                    });
                }
            } else if (column.id !== updatedColumn.id && updatedColumn.fieldInfo) {
                // If column is mapped on an already mapped field, remove that field
                // from the old column to keep it unique.
                if (updatedColumn.fieldInfo.id === column.fieldInfo.id) {
                    column.fieldInfo = null;
                }
            }
        }
    }

    _getCSVFormattingOptions() {
        return {
            encoding: {
                label: _lt("Encoding:"),
                type: "select",
                value: "utf-8",
                options: [
                    "utf-8",
                    "utf-16",
                    "windows-1252",
                    "latin1",
                    "latin2",
                    "big5",
                    "gb18030",
                    "shift_jis",
                    "windows-1251",
                    "koir8_r",
                ],
            },
            separator: {
                label: _lt("Separator:"),
                type: "select",
                value: ",",
                options: [
                    { value: ",", label: _lt("Comma") },
                    { value: ";", label: _lt("Semicolon") },
                    { value: "\t", label: _lt("Tab") },
                    { value: " ", label: _lt("Space") },
                ],
            },
            quoting: {
                label: _lt("Text Delimiter:"),
                type: "input",
                value: '"',
                options: "",
            },
            date_format: {
                label: _lt("Date Format:"),
                type: "select",
                value: "YYYY-MM-DD",
                options: [
                    "%Y-%m-%d",
                    "YYYY-MM-DD",
                    "DD/MM/YY",
                    "DD/MM/YYYY",
                    "DD-MM-YYYY",
                    "DD-MMM-YY",
                    "DD-MMM-YYYY",
                    "MM/DD/YY",
                    "MM/DD/YYYY",
                    "MM-DD-YY",
                    "MM-DD-YYYY",
                    "DDMMYY",
                    "DDMMYYYY",
                    "YYMMDD",
                    "YYYYMMDD",
                    "YY/MM/DD",
                    "YYYY/MM/DD",
                    "MMDDYY",
                    "MMDDYYYY",
                ],
            },
            datetime_format: {
                label: _lt("Datetime Format:"),
                type: "input",
                value: "",
                options: "",
            },
            float_thousand_separator: {
                label: _lt("Thousands Separator:"),
                type: "select",
                value: ",",
                options: [
                    { value: ",", label: _lt("Comma") },
                    { value: ".", label: _lt("Dot") },
                    { value: "", label: _lt("No Separator") },
                ],
            },
            float_decimal_separator: {
                label: _lt("Decimals Separator:"),
                type: "select",
                value: ".",
                options: [
                    { value: ",", label: _lt("Comma") },
                    { value: ".", label: _lt("Dot") },
                ],
            },
        };
    }
}

/**
 * @returns {BaseImportModel}
 */
export function useImportModel({ env, resModel, context, orm }) {
    return reactive(new BaseImportModel({ env, resModel, context, orm }));
}
