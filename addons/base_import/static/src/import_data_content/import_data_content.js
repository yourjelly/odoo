/** @odoo-module **/

import { Component, markup } from "@odoo/owl";
import { fuzzyLookup } from "@web/core/utils/search";
import { AdvancedSelect } from "@web/core/advanced_select/advanced_select";
import { ImportDataColumnError } from "../import_data_column_error/import_data_column_error";
import { ImportDataOptions } from "../import_data_options/import_data_options";

export class ImportDataContent extends Component {
    
    getGroups(column) {
        return [
            this.makeGroup(column.fields.basic),
            this.makeGroup(column.fields.suggested, "Suggested Field"),
            this.makeGroup(column.fields.additional, "Additional Fields"),
            this.makeGroup(column.fields.relational, "Relation Fields"),
        ];
    }

    getTooltipDetails(field) {
        return JSON.stringify({
            resModel: field.model_name,
            debug: true,
            field: {
                name: field.name,
                label: field.string,
                type: field.type,
            },
        });
    }

    makeGroup(fields, label) {
        return {
            label,
            optionTemplate: "ImportDataContent.dropdownOptionTemplate",
            options: (searchString) => this.filterColumns(searchString, fields),
        };
    }

    filterColumns(searchString, fields) {
        const filteredFields = searchString
            ? fuzzyLookup(searchString, fields, (column) => column.string)
            : [...fields];
        filteredFields.sort((a, b) => a.string.localeCompare(b.string));
        return filteredFields.map((field) => ({ label: field.string, value: field }));
    }

    getTooltip(column) {
        const displayCount = 5;
        if (column.previews.length > displayCount) {
            return JSON.stringify({
                lines: [
                    ...column.previews.slice(0, displayCount - 1),
                    `(+${column.previews.length - displayCount + 1})`,
                ],
            });
        } else {
            return JSON.stringify({ lines: column.previews.slice(0, displayCount) });
        }
    }

    getErrorMessageClass(messages, type, index) {
        return `alert alert-${type} m-0 p-2 ${index === messages.length - 1 ? "" : "mb-2"}`;
    }

    getCommentClass(column, comment, index) {
        return `alert-${comment.type} ${index < column.comments.length - 1 ? "mb-2" : "mb-0"}`;
    }

    getCommentContent(comment) {
        return markup(comment.content);
    }
}

ImportDataContent.template = "ImportDataContent";
ImportDataContent.components = {
    ImportDataColumnError,
    ImportDataOptions,
    AdvancedSelect,
};

ImportDataContent.props = {
    columns: { type: Array },
    isFieldSet: { type: Function },
    onOptionChanged: { type: Function },
    onFieldChanged: { type: Function },
    options: { type: Object },
    importMessages: { type: Object },
    previewError: { type: String, optional: true },
};
