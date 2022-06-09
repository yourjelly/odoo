/** @odoo-module **/

import {
    combineAttributes,
    createElement,
    extractAttributes,
    stringToOrderBy,
    toStringExpression,
    XMLParser,
} from "@web/core/utils/xml";
import { Field } from "@web/fields/field";
import { archParseBoolean, getActiveActions } from "@web/views/helpers/utils";

/**
 * NOTE ON 't-name="kanban-box"':
 *
 * Multiple roots are supported in kanban box template definitions, however there
 * are a few things to keep in mind when doing so:
 *
 * - each root will generate its own card, so it would be preferable to make the
 * roots mutually exclusive to avoid rendering multiple cards for the same record;
 *
 * - certain fields such as the kanban 'color' or the 'handle' field are based on
 * the last encountered node, so it is advised to keep the same values for those
 * fields within all roots to avoid inconsistencies.
 */

const KANBAN_BOX_ATTRIBUTE = "kanban-box";
const ACTION_TYPES = ["action", "object"];
const SPECIAL_TYPES = [...ACTION_TYPES, "edit", "open", "delete", "url", "set_cover"];
const TRANSPILED_EXPRESSIONS = [
    // Action names
    { regex: /\bwidget.editable\b/g, value: "canEditRecord()" },
    { regex: /\bwidget.deletable\b/g, value: "canDeleteRecord()" },
    // Special case: 'isHtmlEmpty' method
    { regex: /\bwidget.isHtmlEmpty\b/g, value: "isHtmlEmpty" },
    // `widget.prop` => `props.prop`
    { regex: /\bwidget\.(\w+)\b/g, value: "props.$1" },
    // `#{expr}` => `{{expr}}`
    { regex: /#{([^}]+)}/g, value: "{{$1}}" },
    // `kanban_image(model, field, idOrIds[, placeholder])` => `imageSrcFromRecordInfo(recordInfo, record)`
    {
        regex: /kanban_image\(([^)]*)\)/g,
        value: (_match, group) => {
            const [model, field, idOrIds, placeholder] = group.split(",");
            const recordInfo = { model, field, idOrIds, placeholder };
            const infoString = Object.entries(recordInfo)
                .map(([k, v]) => `${k}:${v}`)
                .join(",");
            return `imageSrcFromRecordInfo({${infoString}},record)`;
        },
    },
    // `kanban_color(value)` => `getColorClass(record)`
    { regex: /\bkanban_color\(([^)]*)\)/g, value: `getColorClass($1)` },
    // `kanban_getcolor(value)` => `getColorIndex(record)`
    { regex: /\bkanban_getcolor\(([^)]*)\)/g, value: `getColorIndex($1)` },
    // `kanban_getcolorname(value)` => `getColorName(record)`
    { regex: /\bkanban_getcolorname\(([^)]*)\)/g, value: `getColorName($1)` },
    // `record.prop.value` => `getValue(record,'prop')`
    { regex: /\brecord\.(\w+)\.value\b/g, value: `getValue(record,'$1')` },
    // `record.prop.raw_value` => `getRawValue(record,'prop')`
    { regex: /\brecord\.(\w+)\.raw_value\b/g, value: `getRawValue(record,'$1')` },
    // `record.prop` => `record.data.prop`
    { regex: /\brecord\.(\w+)\b/g, value: `record.data.$1` },
    // `selection_mode` => `isInSelectMode`
    { regex: /\bselection_mode\b/g, value: `isInSelectMode` },
];

function isValidBox(el) {
    return el.tagName !== "t" || el.hasAttribute("t-component");
}

export class KanbanArchParser extends XMLParser {
    parse(arch, models, modelName) {
        const fields = models[modelName];
        const xmlDoc = this.parseXML(arch);
        const className = xmlDoc.getAttribute("class") || null;
        let defaultOrder = stringToOrderBy(xmlDoc.getAttribute("default_order") || null);
        const defaultGroupBy = xmlDoc.getAttribute("default_group_by");
        const limit = xmlDoc.getAttribute("limit");
        const recordsDraggable = archParseBoolean(xmlDoc.getAttribute("records_draggable"), true);
        const activeActions = {
            ...getActiveActions(xmlDoc),
            groupArchive: archParseBoolean(xmlDoc.getAttribute("archivable"), true),
            groupCreate: archParseBoolean(xmlDoc.getAttribute("group_create"), true),
            groupDelete: archParseBoolean(xmlDoc.getAttribute("group_delete"), true),
            groupEdit: archParseBoolean(xmlDoc.getAttribute("group_edit"), true),
        };
        const onCreate =
            activeActions.create &&
            archParseBoolean(xmlDoc.getAttribute("quick_create"), true) &&
            xmlDoc.getAttribute("on_create");
        const quickCreateView = xmlDoc.getAttribute("quick_create_view");
        const tooltipInfo = {};
        let colorField = "color";
        let cardColorField = null;
        let handleField = null;
        const fieldNodes = {};
        const jsClass = xmlDoc.getAttribute("js_class");
        const action = xmlDoc.getAttribute("action");
        const type = xmlDoc.getAttribute("type");
        const openAction = action && type ? { action, type } : null;
        const subTemplateDocs = {};
        let boxTemplateDoc;

        // Root level of the template
        this.visitXML(xmlDoc, (node) => {
            if (node.getAttribute("t-name")) {
                const tname = node.getAttribute("t-name");
                if (tname === KANBAN_BOX_ATTRIBUTE) {
                    boxTemplateDoc = node;
                } else {
                    subTemplateDocs[tname] = node;
                }
                node.removeAttribute("t-name");
                return;
            }
            // Case: field node
            if (node.tagName === "field") {
                // In kanban, we display many2many fields as tags by default
                const widget = node.getAttribute("widget");
                if (!widget && models[modelName][node.getAttribute("name")].type === "many2many") {
                    node.setAttribute("widget", "many2many_tags");
                }
                const fieldInfo = Field.parseFieldNode(node, models, modelName, "kanban", jsClass);
                const name = fieldInfo.name;
                fieldNodes[name] = fieldInfo;
                node.setAttribute("field_id", name);
                if (fieldInfo.options.group_by_tooltip) {
                    tooltipInfo[name] = fieldInfo.options.group_by_tooltip;
                }
                if (!fieldInfo.widget) {
                    // Fields without a specified widget are rendered as simple
                    // spans in kanban records.
                    const tesc = createElement("span", {
                        "t-esc": `getValue(record,'${name}')`,
                        modifiers: node.getAttribute("modifiers") || "{}",
                    });
                    node.replaceWith(tesc);
                } else if (fieldInfo.widget === "handle") {
                    handleField = name;
                }
            }
            // Converts server qweb attributes to Owl attributes.
            for (let { name, value: attrValue } of node.attributes) {
                for (const { regex, value } of TRANSPILED_EXPRESSIONS) {
                    attrValue = attrValue.replace(regex, value);
                }
                node.setAttribute(name, attrValue);
            }
            // Keep track of last update so images can be reloaded when they may have changed.
            if (node.tagName === "img") {
                const attSrc = node.getAttribute("t-att-src");
                if (
                    attSrc &&
                    attSrc.includes("imageSrcFromRecordInfo") &&
                    !fieldNodes.__last_update
                ) {
                    fieldNodes.__last_update = { type: "datetime" };
                }
            }
        });

        if (!boxTemplateDoc) {
            throw new Error(`Missing '${KANBAN_BOX_ATTRIBUTE}' template.`);
        }

        // Concrete kanban box elements in the template
        const validBoxes = isValidBox(boxTemplateDoc) ? [boxTemplateDoc] : boxTemplateDoc.children;
        const box = createElement("t", validBoxes);
        for (const child of box.children) {
            child.setAttribute("t-att-tabindex", "isSample ? -1 : 0");
            child.setAttribute("role", "article");
            child.setAttribute("t-att-class", "getRecordClasses(record,groupOrRecord.group)");
            child.setAttribute("t-att-data-id", "canResequenceRecords and record.id");
            child.setAttribute("t-on-click", "(ev) => this.onRecordClick(record, ev)");

            // Generate a dropdown for the current box
            const dropdown = createElement("Dropdown", {
                position: toStringExpression("bottom-end"),
            });
            const togglerClass = [];
            const menuClass = [];
            const transfers = [];
            let dropdownInserted = false;

            // Dropdown element
            for (const el of child.querySelectorAll(".dropdown,.o_kanban_manage_button_section")) {
                const classes = el.className
                    .split(/\s+/)
                    .filter((cls) => cls && cls !== "dropdown");
                combineAttributes(dropdown, "class", classes);
                if (!dropdownInserted) {
                    transfers.push(() => el.replaceWith(dropdown));
                    dropdownInserted = true;
                }
            }

            // Dropdown toggler content
            for (const el of child.querySelectorAll(
                ".dropdown-toggle,.o_kanban_manage_toggle_button"
            )) {
                togglerClass.push("btn", el.getAttribute("class"));
                const togglerSlot = createElement("t", { "t-set-slot": "toggler" }, el.children);
                dropdown.appendChild(togglerSlot);
                if (dropdownInserted) {
                    transfers.push(() => el.remove());
                } else {
                    transfers.push(() => el.replaceWith(dropdown));
                    dropdownInserted = true;
                }
            }

            // Dropdown menu content
            for (const el of child.getElementsByClassName("dropdown-menu")) {
                menuClass.push(el.getAttribute("class"));
                dropdown.append(...el.children);
                if (dropdownInserted) {
                    transfers.push(() => el.remove());
                } else {
                    transfers.push(() => el.replaceWith(dropdown));
                    dropdownInserted = true;
                }
            }

            // Apply DOM transfers
            transfers.forEach((transfer) => transfer());

            dropdown.setAttribute("menuClass", toStringExpression(menuClass.join(" ")));
            dropdown.setAttribute("togglerClass", toStringExpression(togglerClass.join(" ")));
        }

        // Progressbar
        let progressAttributes = false;
        for (const el of xmlDoc.getElementsByTagName("progressbar")) {
            const attrs = extractAttributes(el, ["field", "colors", "sum_field", "help"]);
            progressAttributes = {
                fieldName: attrs.field,
                colors: JSON.parse(attrs.colors),
                sumField: fields[attrs.sum_field] || false,
                help: attrs.help,
            };
        }

        // Color and color picker
        for (const child of box.children) {
            const { color } = extractAttributes(child, ["color"]);
            if (color) {
                cardColorField = color;
            }
        }
        for (const el of [...box.getElementsByClassName("oe_kanban_colorpicker")]) {
            const field = el.getAttribute("data-field");
            if (field) {
                colorField = field;
            }
            el.replaceWith(createElement("t", { "t-call": "web.KanbanColorPicker" }));
        }

        // Special actions
        for (const el of box.querySelectorAll("a[type],button[type]")) {
            const type = el.getAttribute("type");
            if (!SPECIAL_TYPES.includes(type)) {
                // Not a supported action type.
                continue;
            }

            combineAttributes(el, "class", [
                "oe_kanban_action",
                `oe_kanban_action_${el.tagName.toLowerCase()}`,
            ]);

            if (ACTION_TYPES.includes(type)) {
                if (!el.hasAttribute("debounce")) {
                    // action buttons are debounced in kanban records
                    el.setAttribute("debounce", 300);
                }
                // View buttons will be compiled in compileButton, no further processing
                // is needed here.
                continue;
            }

            const params = extractAttributes(el, ["type"]);
            if (type === "set_cover") {
                const { "data-field": fieldName, "auto-open": autoOpen } = extractAttributes(el, [
                    "data-field",
                    "auto-open",
                ]);
                const widget = fieldNodes[fieldName].widget;
                Object.assign(params, { fieldName, widget, autoOpen });
            }
            const strParams = Object.keys(params)
                .map((k) => `${k}:"${params[k]}"`)
                .join(",");
            el.setAttribute("t-on-click", `() => this.triggerAction(record,group,{${strParams}})`);
        }

        if (!defaultOrder.length && handleField) {
            defaultOrder = stringToOrderBy(handleField);
        }

        return {
            arch,
            activeActions,
            activeFields: fieldNodes, // TODO process
            className,
            defaultGroupBy,
            fieldNodes,
            handleField,
            colorField,
            defaultOrder,
            onCreate,
            openAction,
            quickCreateView,
            recordsDraggable,
            limit: limit && parseInt(limit, 10),
            progressAttributes,
            cardColorField,
            subTemplateDocs,
            cardTemplateDoc: box,
            tooltipInfo,
            examples: xmlDoc.getAttribute("examples"),
            __rawArch: arch,
        };
    }
}
