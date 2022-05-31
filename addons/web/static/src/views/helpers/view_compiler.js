/** @odoo-module **/

import { Domain } from "@web/core/domain";
import {
    combineAttributes,
    createElement,
    createTextNode,
    toStringExpression,
} from "@web/core/utils/xml";

/**
 * @typedef Compiler
 * @property {string} tag
 * @property {(el: Element, params: Record<string, any>) => Element} fn
 */

const { useComponent, xml } = owl;

const templateIds = Object.create(null);

/**
 * @param {Element} parent
 * @param {Node | Node[] | void} node
 */
export function append(parent, node) {
    if (!node) {
        return;
    }
    if (Array.isArray(node)) {
        parent.append(...node.filter(Boolean));
    } else {
        parent.append(node);
    }
}

function appendAttf(el, attr, string) {
    const attrKey = `t-attf-${attr}`;
    const attrVal = el.getAttribute(attrKey);
    el.setAttribute(attrKey, appendToExpr(attrVal, string));
}

function appendToExpr(expr, string) {
    const re = /{{.*}}/;
    const oldString = re.exec(expr);
    if (oldString) {
        string = `${oldString} ${string}`;
    }
    return `{{${string} }}`;
}

/**
 * @param {Element} el
 * @param {string} attr
 * @param {string} string
 */
function appendAttr(el, attr, string) {
    const attrKey = `t-att-${attr}`;
    const attrVal = el.getAttribute(attrKey);
    el.setAttribute(attrKey, appendToStringifiedObject(attrVal, string));
}

/**
 * @param {string} originalTattr
 * @param {string} string
 * @returns {string}
 */
function appendToStringifiedObject(originalTattr, string) {
    const re = /{(.*)}/;
    const oldString = re.exec(originalTattr);

    if (oldString) {
        string = `${oldString[1]},${string}`;
    }
    return `{${string}}`;
}

/**
 * @param {any} invisible
 * @param {Element} compiled
 * @param {Record<string, any>} params
 * @returns {Element}
 */
function applyInvisible(invisible, compiled, params) {
    if (!invisible) {
        return compiled;
    }
    if (typeof invisible === "boolean" && !params.enableInvisible) {
        return;
    }
    if (!params.enableInvisible) {
        combineAttributes(
            compiled,
            "t-if",
            `!evalDomain(record,${JSON.stringify(invisible)})`,
            " and "
        );
    } else {
        let expr;
        if (Array.isArray(invisible)) {
            expr = `evalDomain(record,${JSON.stringify(invisible)})`;
        } else {
            expr = invisible;
        }
        appendAttr(compiled, "class", `o_invisible_modifier:${expr}`);
    }
    return compiled;
}

/**
 * @param {Element} target
 * @param  {...Element} sources
 * @returns {Element}
 */
export function assignOwlDirectives(target, ...sources) {
    for (const source of sources) {
        for (const { name, value } of source.attributes) {
            if (name.startsWith("t-")) {
                target.setAttribute(name, value);
            }
        }
    }
    return target;
}

/**
 * Encodes an object into a string usable inside a pre-compiled template
 * @param  {Object}
 * @return {string}
 */
export function encodeObjectForTemplate(obj) {
    return `"${encodeURI(JSON.stringify(obj))}"`;
}

/**
 * Decodes a string within an attribute into an Object
 * @param  {string} str
 * @return {Object}
 */
export function decodeObjectForTemplate(str) {
    return JSON.parse(decodeURI(str));
}

/**
 * @param {Record<string, any>} obj
 * @returns {string}
 */
function objectToString(obj) {
    return `{${Object.entries(obj)
        .map((t) => t.join(":"))
        .join(",")}}`;
}

/**
 * @param {Element} el
 * @param {Element} compiled
 */
function copyAttributes(el, compiled) {
    if (getTagName(el) === "button") {
        return;
    }

    const isComponent = isComponentNode(compiled);
    const classes = el.className;
    if (classes) {
        compiled.classList.add(...classes.split(/\s+/).filter(Boolean));
        if (isComponent) {
            compiled.setAttribute("class", `'${compiled.className}'`);
        }
    }

    for (const attName of ["style", "placeholder"]) {
        let att = el.getAttribute(attName);
        if (att) {
            if (isComponent) {
                att = toStringExpression(att);
            }
            compiled.setAttribute(attName, att);
        }
    }
}

/**
 * @param {Element} el
 * @param {string} modifierName
 * @returns {boolean | boolean[]}
 */
function getModifier(el, modifierName) {
    // cf python side def transfer_node_to_modifiers
    // modifiers' string are evaluated to their boolean or array form
    const modifiers = JSON.parse(el.getAttribute("modifiers") || "{}");
    const mod = modifierName in modifiers ? modifiers[modifierName] : false;
    return Array.isArray(mod) ? mod : !!mod;
}

/**
 * @param {any} node
 * @returns {string}
 */
function getTagName(node) {
    return node.tagName || "";
}

/**
 * @param {any} node
 * @returns {string}
 */
function getTitleTagName(node) {
    return getTagName(node)[0].toUpperCase() + getTagName(node).slice(1);
}

/**
 * @param {any} invisibleModifer
 * @param {{ enableInvisible?: boolean }} params
 * @returns {boolean}
 */
function isAlwaysInvisible(invisibleModifer, params) {
    return !params.enableInvisible && typeof invisibleModifer === "boolean" && invisibleModifer;
}

/**
 * @param {Node} node
 * @returns {boolean}
 */
function isComment(node) {
    return node.nodeType === 8;
}

/**
 * @param {Element} el
 * @returns {boolean}
 */
export function isComponentNode(el) {
    return (
        el.tagName === getTitleTagName(el) || (el.tagName === "t" && "t-component" in el.attributes)
    );
}

/**
 * @param {Node} node
 * @returns {boolean}
 */
function isRelevantTextNode(node) {
    return isTextNode(node) && !!node.nodeValue.trim();
}

/**
 * @param {Node} node
 * @returns {boolean}
 */
function isTextNode(node) {
    return node.nodeType === 3;
}

/**
 * @param {string} title
 * @returns {Element}
 */
function makeSeparator(title) {
    const separator = createElement("div");
    separator.className = "o_horizontal_separator";
    separator.textContent = title;
    return separator;
}

export class ViewCompiler {
    constructor() {
        /** @type {number} */
        this.id = 1;
        /** @type {Record<string, Element[]>} */
        this.labels = {};
        /** @type {Compiler[]} */
        this.compilers = [];
        this.encounteredFields = {};
        this.setup(); //Used by FormCompiler, SettingsFormCompiler, ...
    }

    setup() {}

    /**
     * @param {Element} xmlElement
     * @param {Record<string, any>} params
     * @returns {Element}
     */
    compile(xmlElement, params = {}) {
        const newRoot = createElement("t");
        const child = this.compileNode(xmlElement, params);
        child.setAttribute("t-ref", "compiled_view_root");
        append(newRoot, child);
        return newRoot;
    }

    /**
     * @param {Node} node
     * @param {Record<string, any>} params
     * @returns {Element | Text | void}
     */
    compileNode(node, params = {}, evalInvisible = true, copy = true) {
        if (isComment(node)) {
            return;
        }
        if (isRelevantTextNode(node)) {
            return createTextNode(node.nodeValue);
        } else if (isTextNode(node)) {
            return;
        }

        let invisible;
        if (evalInvisible) {
            invisible = getModifier(node, "invisible");
            if (isAlwaysInvisible(invisible, params)) {
                return;
            }
        }

        const registryCompiler = this.compilers.find(
            (cp) => cp.tag === getTagName(node) && (!cp.class || node.classList.contains(cp.class))
        );
        const compiler =
            (registryCompiler && registryCompiler.fn) ||
            this[`compile${getTitleTagName(node)}`] ||
            this.compileGenericNode;

        let compiledNode = compiler.call(this, node, params);

        if (copy && compiledNode) {
            copyAttributes(node, compiledNode);
        }

        if (evalInvisible && compiledNode) {
            compiledNode = applyInvisible(invisible, compiledNode, params);
        }
        return compiledNode;
    }

    /**
     * @param {string} fieldName
     * @returns {Element[]}
     */
    getLabels(fieldName) {
        const labels = this.labels[fieldName] || [];
        this.labels[fieldName] = null;
        return labels;
    }

    /**
     * @param {string} fieldName
     * @param {Element} label
     */
    pushLabel(fieldName, label) {
        this.labels[fieldName] = this.labels[fieldName] || [];
        this.labels[fieldName].push(label);
    }

    // ------------------------------------------------------------------------
    // Compilers
    // ------------------------------------------------------------------------

    /**
     * @param {Element} el
     * @param {Record<string, any>} params
     * @returns {Element}
     */
    compileButton(el, params) {
        const button = createElement("ViewButton", { record: "record" });

        // Props
        const clickParams = {};
        const stringPropsAttributes = ["string", "size", "title", "icon"];
        const clickParamsAttributes = [
            "name",
            "type",
            "args",
            "context",
            "close",
            "confirm",
            "special",
            "effect",
            "help",
            "modifiers",
            // WOWL SAD: is adding the support for debounce attribute here justified or should we
            // just override compileButton in kanban compiler to add the debounce?
            "debounce",
        ];
        for (const { name, value } of el.attributes) {
            if (stringPropsAttributes.includes(name)) {
                button.setAttribute(name, `\`${value}\``);
            } else if (clickParamsAttributes.includes(name)) {
                clickParams[name] = value;
            }
        }
        button.setAttribute("clickParams", JSON.stringify(clickParams));
        button.setAttribute("className", `'${el.className}'`);
        assignOwlDirectives(button, el);

        // Button's body
        const buttonContent = [];
        for (const child of el.childNodes) {
            const compiled = this.compileNode(child, params);
            if (compiled) {
                buttonContent.push(compiled);
            }
        }
        if (buttonContent.length) {
            const contentSlot = createElement("t");
            contentSlot.setAttribute("t-set-slot", "contents");
            append(button, contentSlot);
            for (const buttonChild of buttonContent) {
                append(contentSlot, buttonChild);
            }
        }
        return button;
    }

    /**
     * @param {Element} el
     * @param {Record<string, any>} params
     * @returns {Element}
     */
    compileButtonBox(el, params) {
        el.classList.remove("oe_button_box");
        const buttonBox = createElement("ButtonBox");
        let slotId = 0;

        for (const child of el.children) {
            const invisible = getModifier(child, "invisible");
            if (isAlwaysInvisible(invisible, params)) {
                continue;
            }
            const mainSlot = createElement("t", {
                "t-set-slot": `slot_${slotId++}`,
                isVisible:
                    invisible !== false ? `!evalDomain(record,${JSON.stringify(invisible)})` : true,
            });
            append(mainSlot, this.compileNode(child, params, false, true));
            append(buttonBox, mainSlot);
        }

        return buttonBox;
    }

    /**
     * @param {Element} el
     * @returns {Element}
     */
    compileField(el, params) {
        const fieldName = el.getAttribute("name");
        const fieldString = el.getAttribute("string");
        const fieldId = el.getAttribute("field_id") || fieldName;

        const field = createElement("Field");
        field.setAttribute("id", `'${fieldId}'`);
        field.setAttribute("name", `'${fieldName}'`);
        field.setAttribute("record", "record");
        field.setAttribute("fieldInfo", `fieldNodes['${fieldId}']`);

        // FIXME WOWL: not necessary?
        // if ("mode" in el.attributes) {
        //     const viewModes = el.getAttribute("mode").split(",");
        //     field.setAttribute("viewMode", `${JSON.stringify(viewModes)}`);
        // }

        // FIXME WOWL: only for x2many fields
        field.setAttribute(
            "archs",
            `'views' in record.fields.${fieldName} and record.fields.${fieldName}.views`
        );

        let widgetName;
        if (el.hasAttribute("widget")) {
            widgetName = el.getAttribute("widget");
            field.setAttribute("type", `'${widgetName}'`);
        }

        const labelsForAttr = el.getAttribute("id") || fieldName;
        const labels = this.getLabels(labelsForAttr);
        const dynamicLabel = (label) => {
            const formLabel = this.createLabelFromField(
                fieldId,
                fieldName,
                fieldString,
                label,
                params
            );
            label.replaceWith(formLabel);
            return formLabel;
        };
        for (const label of labels) {
            dynamicLabel(label);
        }
        this.encounteredFields[fieldName] = dynamicLabel;
        return field;
    }

    createLabelFromField(fieldId, fieldName, fieldString, label, params) {
        const props = {
            id: `'${fieldId}'`,
            fieldName: `'${fieldName}'`,
            record: "record",
            fieldInfo: `fieldNodes['${fieldId}']`,
        };
        let labelText = label.textContent || fieldString;
        labelText = labelText
            ? toStringExpression(labelText)
            : `record.fields['${fieldName}'].string`;
        return createElement("FormLabel", {
            "t-props": objectToString(props),
            string: labelText,
        });
    }

    /**
     * @param {Element} el
     * @param {Record<string, any>} params
     * @returns {Element}
     */
    compileForm(el, params) {
        const form = createElement("div");
        form.setAttribute(
            `t-attf-class`,
            "{{props.record.isInEdition ? 'o_form_editable' : 'o_form_readonly'}}"
        );
        if (params.className) {
            form.setAttribute("t-att-class", params.className);
        }
        let hasSheet = false;
        for (const child of el.childNodes) {
            hasSheet = hasSheet || getTagName(child) === "sheet";
            append(form, this.compileNode(child, params));
        }
        if (!hasSheet) {
            form.className = "o_form_nosheet";
        }
        return form;
    }

    /**
     * @param {Element} el
     * @param {Record<string, any>} params
     * @returns {Element}
     */
    compileGenericNode(el, params) {
        if (
            el.nodeName === "div" &&
            el.getAttribute("name") === "button_box" &&
            el.children.length
        ) {
            return this.compileButtonBox(el, params);
        }
        const compiled = createElement(el.tagName);
        const metaAttrs = ["modifiers", "attrs", "invisible", "readonly"];
        for (const attr of el.attributes) {
            if (metaAttrs.includes(attr.name)) {
                continue;
            }
            compiled.setAttribute(attr.name, attr.value);
        }
        for (const child of el.childNodes) {
            append(compiled, this.compileNode(child, params));
        }
        return compiled;
    }

    /**
     * @param {Element} el
     * @param {Record<string, any>} params
     * @returns {Element}
     */
    compileGroup(el, params) {
        const isOuterGroup = [...el.children].some((c) => getTagName(c) === "group");
        const formGroup = createElement(isOuterGroup ? "OuterGroup" : "InnerGroup");

        let slotId = 0;
        let sequence = 0;

        if (el.hasAttribute("col")) {
            formGroup.setAttribute("maxCols", el.getAttribute("col"));
        }

        if (el.hasAttribute("string")) {
            const titleSlot = createElement("t", { "t-set-slot": "title" }, [
                makeSeparator(el.getAttribute("string")),
            ]);
            append(formGroup, titleSlot);
        }

        let forceNewline = false;
        for (const child of el.children) {
            const tagName = getTagName(child);

            if (tagName === "newline") {
                forceNewline = true;
                continue;
            }

            const invisible = getModifier(child, "invisible");
            if (isAlwaysInvisible(invisible, params)) {
                continue;
            }

            const mainSlot = createElement("t", {
                "t-set-slot": `item_${slotId++}`,
                type: "'item'",
                sequence: sequence++,
                "t-slot-scope": "scope",
            });
            let itemSpan = parseInt(child.getAttribute("colspan") || "1", 10);

            if (forceNewline) {
                mainSlot.setAttribute("newline", true);
                forceNewline = false;
            }

            let slotContent;
            if (tagName === "field") {
                const addLabel = child.hasAttribute("nolabel")
                    ? child.getAttribute("nolabel") !== "1"
                    : true;
                slotContent = this.compileNode(child, params, false, true);
                if (addLabel && !isOuterGroup) {
                    itemSpan = itemSpan === 1 ? itemSpan + 1 : itemSpan;
                    const fieldName = child.getAttribute("name");
                    const fieldId = slotContent.getAttribute("id") || fieldName;
                    const props = {
                        id: `${fieldId}`,
                        fieldName: `'${fieldName}'`,
                        record: "record",
                        string: child.hasAttribute("string")
                            ? toStringExpression(child.getAttribute("string"))
                            : `record.fields.${fieldName}.string`,
                        fieldInfo: `fieldNodes[${fieldId}]`,
                    };
                    // note: remove this oe_read/edit_only logic when form view
                    // will always be in edit mode
                    if (child.classList.contains("oe_read_only")) {
                        props.className = `'oe_read_only'`;
                    } else if (child.classList.contains("oe_edit_only")) {
                        props.className = `'oe_edit_only'`;
                    }
                    mainSlot.setAttribute("props", objectToString(props));
                    mainSlot.setAttribute("Component", "constructor.components.FormLabel");
                    mainSlot.setAttribute("subType", "'item_component'");
                }
            } else {
                if (child.classList.contains("o_td_label") || child.tagName === "label") {
                    mainSlot.setAttribute("subType", "'label'");
                    child.classList.remove("o_td_label");
                }
                slotContent = this.compileNode(child, params, false, true);
            }

            if (slotContent) {
                if (invisible !== false) {
                    mainSlot.setAttribute(
                        "isVisible",
                        `!evalDomain(record,${JSON.stringify(invisible)})`
                    );
                }
                if (itemSpan > 0) {
                    mainSlot.setAttribute("itemSpan", `${itemSpan}`);
                }

                const groupClassExpr = `scope && scope.className`;
                if (isComponentNode(slotContent)) {
                    if (child.tagName !== "button") {
                        if (slotContent.hasAttribute("class")) {
                            mainSlot.prepend(
                                createElement("t", {
                                    "t-set": "addClass",
                                    "t-value": groupClassExpr,
                                })
                            );
                            combineAttributes(
                                slotContent,
                                "class",
                                `(addClass ? " " + addClass : "")`,
                                `+`
                            );
                        } else {
                            slotContent.setAttribute("class", groupClassExpr);
                        }
                    }
                } else {
                    appendAttf(slotContent, "class", `${groupClassExpr} || ""`);
                }
                append(mainSlot, slotContent);
                append(formGroup, mainSlot);
            }
        }
        return formGroup;
    }

    /**
     * @param {Element} el
     * @param {Record<string, any>} params
     * @returns {Element}
     */
    compileHeader(el, params) {
        const statusBar = createElement("div");
        statusBar.className = "o_form_statusbar";
        const buttons = [];
        const others = [];
        for (const child of el.childNodes) {
            const compiled = this.compileNode(child, params);
            if (!compiled) {
                continue;
            }
            if (child.nodeName === "button") {
                buttons.push(compiled);
            } else {
                if (child.nodeName === "field") {
                    compiled.setAttribute("showTooltip", true);
                }
                others.push(compiled);
            }
        }
        if (buttons.length) {
            const divButtons = createElement("div");
            divButtons.className = "o_statusbar_buttons";
            append(divButtons, buttons);
            append(statusBar, divButtons);
        }
        append(statusBar, others);
        return statusBar;
    }

    /**
     * @param {Element} el
     * @param {Record<string, any>} params
     * @returns {Element}
     */
    compileLabel(el, params) {
        const forAttr = el.getAttribute("for");
        // A label can contain or not the labelable Element it is referring to.
        // If it doesn't, there is no `for=`
        // Otherwise, the targetted element is somewhere else among its nextChildren
        if (forAttr) {
            let label = createElement("label");
            const string = el.getAttribute("string");
            if (string) {
                append(label, createTextNode(string));
            }
            if (this.encounteredFields[forAttr]) {
                label = this.encounteredFields[forAttr](label);
            } else {
                this.pushLabel(forAttr, label);
            }
            return label;
        }
        return this.compileGenericNode(el, params);
    }

    /**
     * @param {Element} el
     * @param {Record<string, any>} params
     * @returns {Element}
     */
    compileNotebook(el, params) {
        const noteBook = createElement("Notebook");
        const pageAnchors = [...document.querySelectorAll("[href^=\\#]")]
            .map((a) => CSS.escape(a.getAttribute("href").substring(1)))
            .filter((a) => a.length);
        const noteBookAnchors = {};

        if (el.hasAttribute("class")) {
            noteBook.setAttribute("className", `"${el.getAttribute("class")}"`);
            el.removeAttribute("class");
        }

        for (const child of el.children) {
            if (child.nodeName !== "page") {
                continue;
            }
            const invisible = getModifier(child, "invisible");
            if (isAlwaysInvisible(invisible, params)) {
                continue;
            }

            const pageSlot = createElement("t");
            append(noteBook, pageSlot);

            const pageId = `page_${this.id++}`;
            const pageTitle = toStringExpression(
                child.getAttribute("string") || child.getAttribute("name") || ""
            );
            pageSlot.setAttribute("t-set-slot", pageId);
            pageSlot.setAttribute("title", pageTitle);

            if (child.getAttribute("autofocus") === "autofocus") {
                noteBook.setAttribute("defaultPage", `"${pageId}"`);
            }

            for (const anchor of child.querySelectorAll("[href^=\\#]")) {
                const anchorValue = CSS.escape(anchor.getAttribute("href").substring(1));
                if (!anchorValue.length) continue;
                pageAnchors.push(anchorValue);
                noteBookAnchors[anchorValue] = {
                    origin: `'${pageId}'`,
                };
            }

            let isVisible;
            if (invisible === false) {
                isVisible = "true";
            } else {
                isVisible = `!evalDomain(record,${JSON.stringify(invisible)})`;
            }
            pageSlot.setAttribute("isVisible", isVisible);

            for (const contents of child.children) {
                append(pageSlot, this.compileNode(contents, params));
            }
        }

        if (pageAnchors.length) {
            // If anchors from the page are targetting an element
            // present in the notebook, it must be aware of the
            // page that contains the corresponding element
            for (const anchor of pageAnchors) {
                let pageId = 1;
                for (const child of el.children) {
                    if (child.querySelector(`#${anchor}`)) {
                        noteBookAnchors[anchor].target = `'page_${pageId}'`;
                        noteBookAnchors[anchor] = objectToString(noteBookAnchors[anchor]);
                        break;
                    }
                    pageId++;
                }
            }
            noteBook.setAttribute("anchors", objectToString(noteBookAnchors));
        }

        return noteBook;
    }

    /**
     * @param {Element} el
     * @param {Record<string, any>} params
     * @returns {Element}
     */
    compileSeparator(el, params = {}) {
        const separator = makeSeparator(el.getAttribute("string"));
        copyAttributes(el, separator);
        return applyInvisible(getModifier(el, "invisible"), separator, params);
    }

    /**
     * @param {Element} el
     * @param {Record<string, any>} params
     * @returns {Element}
     */
    compileSheet(el, params) {
        const sheetBG = createElement("div");
        sheetBG.className = "o_form_sheet_bg";

        const sheetFG = createElement("div");
        sheetFG.className = "o_form_sheet";

        append(sheetBG, sheetFG);
        for (const child of el.childNodes) {
            const compiled = this.compileNode(child, params);
            if (!compiled) {
                continue;
            }
            if (child.nodeName === "field") {
                compiled.setAttribute("showTooltip", true);
            }
            append(sheetFG, compiled);
        }
        return sheetBG;
    }

    /**
     * @param {Element} el
     * @returns {Element}
     */
    compileWidget(el) {
        const attrs = {};
        const props = { record: "record", options: "{mode:props.readonly?'readonly':'edit'}" };
        for (const { name, value } of el.attributes) {
            switch (name) {
                case "class":
                case "name": {
                    props[name] = `'${value}'`;
                    break;
                }
                case "modifiers": {
                    attrs.modifiers = JSON.parse(value || "{}");
                    break;
                }
                default: {
                    attrs[name] = value;
                }
            }
        }
        props.node = encodeObjectForTemplate({ attrs });
        const viewWidget = createElement("ViewWidget", props);
        return assignOwlDirectives(viewWidget, el);
    }
}

/**
 * @param {typeof ViewCompiler} ViewCompiler
 * @param {string} templateKey
 * @param {Element} xmlDoc
 * @param {Record<string, any>} [params]
 * @returns {string}
 */
export function useViewCompiler(ViewCompiler, templateKey, xmlDoc, params) {
    const component = useComponent();

    // Assigns special functions to the current component.
    Object.assign(component, {
        evalDomain(record, expr) {
            return new Domain(expr).contains(record.evalContext);
        },
    });

    // Creates a new compiled template if the given template key hasn't been
    // compiled already.
    if (templateKey === undefined) {
        throw new Error("templateKey can not be Undefined!");
    }
    if (!templateIds[templateKey]) {
        const compiledDoc = new ViewCompiler().compile(xmlDoc, params);
        templateIds[templateKey] = xml`${compiledDoc.outerHTML}`;
        // DEBUG -- start
        console.group(`Compiled template (${templateIds[templateKey]}):`);
        console.dirxml(compiledDoc);
        console.groupEnd();
        // DEBUG -- end
    }
    return templateIds[templateKey];
}
