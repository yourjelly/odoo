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
export function applyInvisible(invisible, compiled, params) {
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
export function objectToString(obj) {
    return `{${Object.entries(obj)
        .map((t) => t.join(":"))
        .join(",")}}`;
}

/**
 * @param {Element} el
 * @param {Element} compiled
 */
export function copyAttributes(el, compiled) {
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
export function getModifier(el, modifierName) {
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
export function getTagName(node) {
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
export function isAlwaysInvisible(invisibleModifer, params) {
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
export function makeSeparator(title) {
    const separator = createElement("div");
    separator.className = "o_horizontal_separator";
    separator.textContent = title;
    return separator;
}

export class ViewCompiler {
    constructor() {
        /** @type {number} */
        this.id = 1;
        /** @type {Compiler[]} */
        this.compilers = [];
        this.setup();
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
     * @returns {Element}
     */
    compileField(el, params) {
        const fieldName = el.getAttribute("name");
        const fieldId = el.getAttribute("field_id") || fieldName;

        const field = createElement("Field");
        field.setAttribute("id", `'${fieldId}'`);
        field.setAttribute("name", `'${fieldName}'`);
        field.setAttribute("record", "record");
        field.setAttribute("fieldInfo", `fieldNodes['${fieldId}']`);

        // FIXME WOWL: only for x2many fields
        field.setAttribute(
            "archs",
            `'views' in record.fields.${fieldName} and record.fields.${fieldName}.views`
        );

        if (el.hasAttribute("widget")) {
            field.setAttribute("type", `'${el.getAttribute("widget")}'`);
        }

        return field;
    }

    /**
     * @param {Element} el
     * @param {Record<string, any>} params
     * @returns {Element}
     */
    compileGenericNode(el, params) {
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
