/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";

const parser = new DOMParser();
const serializer = new XMLSerializer();

const RSTRIP_REGEXP = /\n[ \t]*$/;

function rstrip(string) {
    return string.replace(/\s+$/g, "");
}

function addBefore(target, operation) {
    let index = 0;
    let text = "";
    const { firstChild } = operation;
    if (firstChild?.nodeType === 3) {
        index = 1;
        text = firstChild.data;
    }
    const { previousSibling } = target;
    let beforeText = "";
    if (previousSibling?.nodeType === 3) {
        [, beforeText] = previousSibling.data.split(RSTRIP_REGEXP);
        previousSibling.data = rstrip(previousSibling.data) + text;
    } else {
        target.before(document.createTextNode(text));
    }
    const childNodes = [];
    for (let i = index; i < operation.childNodes.length; i++) {
        const childNode = operation.childNodes[i];
        if (childNode.getAttribute?.("position") === "move") {
            const node = getNode(target, childNode);
            removeElement(node);
            childNodes.push(node);
        } else {
            childNodes.push(childNode);
        }
    }
    if (childNodes.length > index) {
        const lastChild = childNodes.at(-1);
        if (lastChild?.nodeType === 3) {
            lastChild.data = rstrip(lastChild.data) + beforeText;
        } else {
            childNodes.push(document.createTextNode(beforeText));
        }
    }
    target.before(...childNodes);
}

function removeElement(element) {
    const { nextSibling, previousSibling } = element;
    if (nextSibling?.nodeType === 3 && previousSibling?.nodeType === 3) {
        if (previousSibling.parentElement.firstChild === previousSibling) {
            previousSibling.data = rstrip(previousSibling.data);
        }
        previousSibling.data += nextSibling.data;
        nextSibling.remove();
    }
    element.remove();
}

function getNode(source, spec) {
    const sourceDoc = source.ownerDocument;
    const documentElement = sourceDoc.documentElement;
    if (spec.tagName === "xpath") {
        const result = sourceDoc.evaluate(
            spec.getAttribute("expr"),
            documentElement,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE
        );
        return result.singleNodeValue;
    }
    if (spec.tagName === "field") {
        const name = spec.getAttribute("name");
        return documentElement.querySelector(`field[name=${name}]`);
    }
    outer: for (const node of documentElement.querySelectorAll(spec.tagName)) {
        for (const { name, value } of spec.attributes) {
            if (name !== "position" && node.getAttribute(name) !== value) {
                continue outer;
            }
        }
        return node;
    }
    return null;
}

/**
 * @param {string} arch
 * @param {string} inherits
 * @returns {string}
 */
export function applyInheritance(arch, inherits) {
    const archXmlDoc = parser.parseFromString(arch, "text/xml");
    const inheritsDoc = parser.parseFromString(inherits, "text/xml");

    let source = archXmlDoc.documentElement;

    const operations = [];
    const operationsFromDataTags = [];
    for (const child of inheritsDoc.documentElement.children) {
        if (child.tagName === "data") {
            for (const c of child.children) {
                operationsFromDataTags.push(c);
            }
        } else {
            operations.push(child);
        }
    }
    operations.push(...operationsFromDataTags);

    for (const operation of operations) {
        const target = getNode(source, operation);
        if (!target) {
            throw new Error(
                _t(`Element '%s' cannot be located in parent view`, "Bad description to improve")
            );
        }
        const position = operation.getAttribute("position") || "inside";
        switch (position) {
            case "replace": {
                const mode = operation.getAttribute("mode") || "outer";
                switch (mode) {
                    case "outer": {
                        const result = inheritsDoc.evaluate(
                            ".//*[text()='$0']",
                            operation,
                            null,
                            XPathResult.ORDERED_NODE_ITERATOR_TYPE
                        );
                        let loc;
                        const locations = [];
                        while ((loc = result.iterateNext())) {
                            locations.push(loc);
                        }
                        for (const loc of locations) {
                            if (loc.firstChild?.nodeType === 3) {
                                loc.firstChild.remove();
                            }
                            loc.append(target.cloneNode(true));
                        }
                        if (target.parentElement) {
                            const childNodes = [];
                            for (let i = 0; i < operation.childNodes.length; i++) {
                                const childNode = operation.childNodes[i];
                                if (childNode.getAttribute?.("position") === "move") {
                                    const node = getNode(source, childNode);
                                    removeElement(node);
                                    childNodes.push(node);
                                } else {
                                    childNodes.push(childNode);
                                }
                            }
                            target.replaceWith(...childNodes);
                        } else {
                            let operationContent = null;
                            let comment = null;
                            for (const child of operation.childNodes) {
                                if (child.nodeType === 1) {
                                    operationContent = child;
                                    break;
                                }
                                if (child.nodeType === 8) {
                                    comment = child;
                                }
                            }
                            source = operationContent.cloneNode(true);
                            if (target.hasAttribute("t-name")) {
                                source.setAttribute("t-name", target.getAttribute("t-name"));
                            }
                            if (comment) {
                                source.prepend(comment);
                            }
                        }
                        break;
                    }
                    case "inner":
                        while (target.firstChild) {
                            target.removeChild(target.lastChild);
                        }
                        target.append(...operation.childNodes);
                        break;
                    default:
                        throw new Error(_t(`Invalid mode attribute: '%s'`, mode));
                }
                break;
            }
            case "attributes": {
                for (const child of operation.children) {
                    if (child.tagName !== "attribute") {
                        continue;
                    }
                    const attributeName = child.getAttribute("name");
                    const firstNode = child.childNodes[0];
                    let value = firstNode?.nodeType === 3 ? firstNode.data : "";
                    if (child.hasAttribute("add") || child.hasAttribute("remove")) {
                        if (firstNode?.nodeType === 3) {
                            throw new Error(); // correspond to assert not child.text
                        }
                        const separator = child.getAttribute("separator", ",");
                        if (separator === " ") {
                            separator === undefined; // ? // not sure about this line
                        }
                        const toRemove = new Set();
                        for (const s of (child.getAttribute("remove") || "").split(separator)) {
                            toRemove.add(s.trim());
                        }
                        const values = [];
                        for (const s of target.getAttribute(attributeName).split(separator)) {
                            const trimmed = s.trim();
                            if (!toRemove.has(trimmed)) {
                                values.push(trimmed);
                            }
                        }
                        for (const s of (child.getAttribute("add") || "").split(separator)) {
                            const trimmed = s.trim();
                            if (trimmed) {
                                values.push(trimmed);
                            }
                        }
                        value = values.join(separator || " ");
                    }
                    if (value) {
                        target.setAttribute(attributeName, value);
                    } else if (target.hasAttribute(attributeName)) {
                        target.removeAttribute(attributeName);
                    }
                }
                break;
            }
            case "inside": {
                const sentinel = document.createElement("sentinel");
                target.append(sentinel);
                addBefore(sentinel, operation);
                removeElement(sentinel);
                break;
            }
            case "after": {
                const sentinel = document.createElement("sentinel");
                target.after(sentinel);
                addBefore(sentinel, operation);
                removeElement(sentinel);
                break;
            }
            case "before": {
                addBefore(target, operation);
                break;
            }
            default:
                throw new Error(_t(`Invalid position attribute: '%s'`, position));
        }
    }
    return serializer.serializeToString(source);
}
