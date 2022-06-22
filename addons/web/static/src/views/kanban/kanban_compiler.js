/** @odoo-module **/

import { createElement, extractAttributes, toStringExpression } from "@web/core/utils/xml";
import { ViewCompiler } from "@web/views/view_compiler";

const INTERP_REGEXP = /\{\{.*?\}\}|#\{.*?\}/g;

export class KanbanCompiler extends ViewCompiler {
    setup() {
        this.ctx.readonly = "read_only_mode";
    }

    /**
     * @override
     */
    compileField(el, params) {
        let compiled;
        if (!el.hasAttribute("widget")) {
            // fields without a specified widget are rendered as simple spans in kanban records
            compiled = createElement("span");
            compiled.setAttribute("t-esc", `record["${el.getAttribute("name")}"].value`);
        } else {
            compiled = super.compileField(el, params);
        }
        const { bold, display } = extractAttributes(el, ["bold", "display"]);
        const classNames = [];
        if (display === "right") {
            classNames.push("float-right");
        } else if (display === "full") {
            classNames.push("o_text_block");
        }
        if (bold) {
            classNames.push("o_text_bold");
        }
        if (classNames.length > 0) {
            compiled.setAttribute("class", `'${classNames.join(" ")}'`);
        }
        const attrs = {};
        for (const attr of el.attributes) {
            attrs[attr.name] = attr.value;
        }
        if (el.hasAttribute("widget")) {
            const attrsParts = Object.entries(attrs).map(([key, value]) => {
                if (key.startsWith("t-attf-")) {
                    key = key.substr(7);
                    value = value.replace(
                        INTERP_REGEXP,
                        (s) => "${" + s.slice(2, s[0] === "{" ? -2 : -1) + "}"
                    );
                    value = toStringExpression(value);
                } else if (key.startsWith("t-att-")) {
                    key = key.substr(6);
                    value = `"" + (${value})`;
                } else if (key.startsWith("t-att")) {
                    throw new Error("t-att on <field> nodes is not supported");
                } else if (!key.startsWith("t-")) {
                    value = toStringExpression(value);
                }
                return `'${key}':${value}`;
            });
            compiled.setAttribute("attrs", `{${attrsParts.join(",")}}`);
        }
        for (const attr in attrs) {
            if (attr.startsWith("t") && !attr.startsWith("t-att")) {
                compiled.setAttribute(attr, attrs[attr]);
            }
        }
        return compiled;
    }

    /**
     * Override to replace t-call attribute values by the key of the corresponding
     * sub template.
     *
     * @override
     */
    compileGenericNode(el, params) {
        if (el.tagName === "t" && el.getAttribute("t-call")) {
            const templateKey = params.subTemplateKeys[el.getAttribute("t-call")];
            if (templateKey) {
                el.setAttribute("t-call", templateKey);
            }
        }
        return super.compileGenericNode(...arguments);
    }
}
