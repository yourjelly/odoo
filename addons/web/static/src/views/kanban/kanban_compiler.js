import { append, createElement, getTag } from "@web/core/utils/xml";
import { archParseBoolean } from "@web/views/utils";
import { ViewCompiler } from "@web/views/view_compiler";

const SPECIAL_TYPES = ["edit", "delete", "archive", "unarchive", "set_cover"];

export class KanbanCompiler extends ViewCompiler {
    setup() {
        this.compilers.push(
            { selector: "kanban", fn: this.compileKanban, doNotCopyAttributes: true },
            { selector: "kanban > header", fn: () => false }, // do nothing
            { selector: "kanban > progressbar", fn: () => false }, // do nothing
            { selector: "kanban > control", fn: () => false } // do nothing
        );
    }

    //-----------------------------------------------------------------------------
    // Compilers
    //-----------------------------------------------------------------------------

    compileKanban(el, params) {
        let withAside = false;
        const kanban = createElement("div");
        const sectionContainer = createElement("div");
        sectionContainer.setAttribute(
            "class",
            "o_kanban_section_container d-flex flex-column w-100"
        );
        for (const child of el.childNodes) {
            if (getTag(child) === "aside") {
                withAside = true;
                append(kanban, this.compileAside(child, params));
            } else if (getTag(child) === "section") {
                append(sectionContainer, this.compileSection(child, params));
            } else if (getTag(child) === "menu") {
                append(kanban, this.compileMenu(child, params));
            } else {
                append(kanban, this.compileNode(child, params));
            }
        }
        append(kanban, sectionContainer);
        kanban.setAttribute("class", `w-100 ${withAside ? "d-flex" : ""}`);
        return kanban;
    }

    compileAside(el, params) {
        const aside = createElement("div");
        const elClass = el.getAttribute("class");
        let asideClass = `o_kanban_aside ${elClass ? elClass : ""}`;
        if (archParseBoolean(el.getAttribute("full"), false)) {
            asideClass += " o_kanban_aside_full";
        }
        aside.setAttribute("class", asideClass);
        for (const child of el.childNodes) {
            append(aside, this.compileNode(child, params));
        }
        return aside;
    }

    compileSection(el, params) {
        const section = createElement("div");
        const elClass = el.getAttribute("class");
        let sectionClass = `d-flex ${
            elClass ? elClass + " " : ""
        }`;
        if (el.getAttribute("type") !== "row") {
            sectionClass += "flex-column";
        }
        section.setAttribute("class", sectionClass);
        for (const child of el.childNodes) {
            append(section, this.compileNode(child, params));
        }
        return section;
    }

    compileMenu(el, params) {
        const menu = createElement("KanbanRecordMenu");
        for (const child of el.childNodes) {
            append(menu, this.compileNode(child, params));
        }
        return menu;
    }

    /**
     * @override
     */
    compileButton(el, params) {
        const type = el.getAttribute("type");
        if (!SPECIAL_TYPES.includes(type)) {
            return super.compileButton(el, params);
        }

        const compiled = createElement(el.nodeName);
        for (const { name, value } of el.attributes) {
            compiled.setAttribute(name, value);
        }
        compiled.setAttribute("t-on-click", `(ev) => __comp__.triggerAction("${type}", ev)`);
        if (getTag(el, true) === "a" && !compiled.hasAttribute("href")) {
            compiled.setAttribute("href", "#");
        }
        for (const child of el.childNodes) {
            append(compiled, this.compileNode(child, params));
        }

        return compiled;
    }

    /**
     * @override
     */
    compileField(el, params) {
        let compiled;
        const recordExpr = params.recordExpr || "__comp__.props.record";
        const dataPointIdExpr = params.dataPointIdExpr || `${recordExpr}.id`;
        if (!el.hasAttribute("widget")) {
            // fields without a specified widget are rendered as simple spans in kanban records
            const fieldId = el.getAttribute("field_id");
            compiled = createElement("span", {
                "t-out": params.formattedValueExpr || `__comp__.getFormattedValue("${fieldId}")`,
            });
        } else {
            compiled = super.compileField(el, params);
            const fieldId = el.getAttribute("field_id");
            compiled.setAttribute("id", `'${fieldId}_' + ${dataPointIdExpr}`);
            // In x2many kanban, records can be edited in a dialog. The same record as the one of
            // the kanban is used for the form view dialog, so its mode is switched to "edit", but
            // we don't want to see it in edition in the background. For that reason, we force its
            // fields to be readonly when the record is in edition, i.e. when it is opened in a form
            // view dialog.
            const readonlyAttr = compiled.getAttribute("readonly");
            if (readonlyAttr) {
                compiled.setAttribute("readonly", `${recordExpr}.isInEdition || (${readonlyAttr})`);
            } else {
                compiled.setAttribute("readonly", `${recordExpr}.isInEdition`);
            }
        }
        return compiled;
    }
}
