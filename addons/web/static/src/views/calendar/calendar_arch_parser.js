/** @odoo-module **/

import { parseDateTime } from "@web/core/l10n/dates";
import { evaluateExpr } from "@web/core/py_js/py";
import { XMLParser } from "@web/core/utils/xml";
import { archParseBoolean } from "../helpers/utils";

const FIELD_ATTRIBUTE_NAMES = [
    "date_start",
    "date_delay",
    "date_stop",
    "all_day",
    "recurrence_update",
    "create_name_field",
    "color",
];
const EVAL_CONTEXT = {
    true: true,
    false: false,
};
const SCALES = ["day", "week", "month", "year"];

export class CalendarArchParser extends XMLParser {
    /**
     * @param {Object} props
     */
    constructor(props) {
        super();

        /** @protected */
        this.props = props;

        /**
         * @protected
         * @type {import("./calendar_types").CalendarViewDescription}
         */
        this.data = {
            canCreate: false,
            canDelete: false,
            canEdit: false,
            date: this.props.date,
            eventLimit: 5,
            fieldMapping: {
                date_start: "date_start",
            },
            fieldNames: [],
            filtersInfo: {},
            formViewId: null,
            hasEditDialog: false,
            hasQuickCreate: false,
            isDateHidden: false,
            isTimeHidden: false,
            popoverFields: {},
            scale: "week",
            scales: [],
            showUnusualDays: false,
        };
    }
    /**
     * @override
     * @returns {import("./calendar_types").CalendarViewDescription}
     */
    parse() {
        this.visitXML(this.props.arch, (node) => {
            switch (node.tagName) {
                case "calendar": {
                    this.visitCalendar(node);
                    break;
                }
                case "field": {
                    this.visitField(node);
                    break;
                }
            }
        });

        return this.data;
    }
    /**
     * @protected
     * @param {HTMLElement} node
     */
    visitCalendar(node) {
        if (!node.hasAttribute("date_start")) {
            throw new Error("Calendar view has not defined 'date_start' attribute.");
        }

        const fieldNames = new Set(this.props.fields.display_name ? ["display_name"] : []);
        for (const fieldAttrName of FIELD_ATTRIBUTE_NAMES) {
            if (node.hasAttribute(fieldAttrName)) {
                const fieldName = node.getAttribute(fieldAttrName);
                fieldNames.add(fieldName);
                this.data.fieldMapping[fieldAttrName] = fieldName;
            }
        }
        this.data.fieldNames = [...fieldNames];

        this.data.eventLimit = evaluateExpr(node.getAttribute("event_limit") || "5", EVAL_CONTEXT);
        if (!Number.isInteger(this.data.eventLimit)) {
            throw new Error(`Calendar view's event limit should be a number`);
        }

        const scaleAttr = node.getAttribute("scales");
        const scales = scaleAttr && scaleAttr.split(",");
        this.data.scales = scaleAttr ? scales.filter((scale) => SCALES.includes(scale)) : SCALES;
        this.data.scale = node.getAttribute("mode") || "week";
        if (!this.data.scales.includes(this.data.scale)) {
            throw new Error(`Calendar view cannot display mode: ${this.data.scale}`);
        }

        const contextDate = this.props.context && this.props.context.initial_date;
        this.data.date =
            (contextDate && parseDateTime(contextDate)) || this.data.date || luxon.DateTime.utc();

        this.data.canEdit = !this.props.fields[this.data.fieldMapping.date_start].readonly;
        this.data.canCreate = archParseBoolean(node.getAttribute("create") || "1");
        this.data.canDelete = archParseBoolean(node.getAttribute("delete") || "1");
        this.data.hasQuickCreate = archParseBoolean(node.getAttribute("quick_add") || "1");
        this.data.hasEditDialog = archParseBoolean(node.getAttribute("event_open_popup") || "0");
        this.data.showUnusualDays = archParseBoolean(node.getAttribute("show_unusual_days") || "0");
        this.data.isDateHidden = archParseBoolean(node.getAttribute("hide_date") || "0");
        this.data.isTimeHidden = archParseBoolean(node.getAttribute("hide_time") || "0");

        this.data.formViewId = node.hasAttribute("form_view_id")
            ? parseInt(node.getAttribute("form_view_id"), 10)
            : false;
        if (!Number.isInteger(this.data.eventLimit) && this.data.eventLimit !== null) {
            throw new Error(`Calendar view's event limit should be a number or null`);
        }
    }
    /**
     * @protected
     * @param {HTMLElement} node
     */
    visitField(node) {
        const fieldName = node.getAttribute("name");
        if (!this.data.fieldNames.includes(fieldName)) {
            this.data.fieldNames.push(fieldName);
        }

        const attributes = {};
        for (const name of node.getAttributeNames()) {
            const value = node.getAttribute(name);
            switch (name) {
                case "modifiers":
                case "options":
                    attributes[name] = evaluateExpr(value, EVAL_CONTEXT);
                    break;
                default:
                    attributes[name] = value;
                    break;
            }
        }
        this.data.popoverFields[fieldName] = attributes;

        const fieldMeta = this.props.fields[fieldName];
        if (!node.hasAttribute("invisible") || node.hasAttribute("filters")) {
            let filterInfo = null;
            if (
                node.hasAttribute("avatar_field") ||
                node.hasAttribute("write_model") ||
                node.hasAttribute("write_field") ||
                node.hasAttribute("color") ||
                node.hasAttribute("filters")
            ) {
                this.data.filtersInfo[fieldName] = this.data.filtersInfo[fieldName] || {
                    avatarFieldName: null,
                    colorFieldName: null,
                    fieldName,
                    filterFieldName: null,
                    label: fieldMeta.string,
                    resModel: fieldMeta.relation,
                    writeFieldName: null,
                    writeResModel: null,
                };
                filterInfo = this.data.filtersInfo[fieldName];
            }
            if (node.hasAttribute("filter_field")) {
                filterInfo.filterFieldName = node.getAttribute("filter_field");
            }
            if (node.hasAttribute("avatar_field")) {
                filterInfo.avatarFieldName = node.getAttribute("avatar_field");
            }
            if (node.hasAttribute("write_model")) {
                filterInfo.writeResModel = node.getAttribute("write_model");
            }
            if (node.hasAttribute("write_field")) {
                filterInfo.writeFieldName = node.getAttribute("write_field");
            }
            if (node.hasAttribute("filters")) {
                if (node.hasAttribute("color")) {
                    filterInfo.colorFieldName = node.getAttribute("color");
                }
                if (node.hasAttribute("avatar_field") && fieldMeta.relation) {
                    if (fieldMeta.relation.includes(["res.users", "res.partners", "hr.employee"])) {
                        filterInfo.avatarFieldName = "image_128";
                    }
                }
            }
        }
    }
}
