/** @odoo-module */

import { isBlock } from "./blocks";
import { paragraphRelatedElements } from "./dom_info";
import { childNodeIndex, DIRECTIONS } from "./position";

/**
 * Splits a text node in two parts.
 * If the split occurs at the beginning or the end, the text node stays
 * untouched and unsplit. If a split actually occurs, the original text node
 * still exists and become the right part of the split.
 *
 * Note: if split after or before whitespace, that whitespace may become
 * invisible, it is up to the caller to replace it by nbsp if needed.
 *
 * @param {Node} textNode
 * @param {number} offset
 * @param {DIRECTIONS} originalNodeSide Whether the original node ends up on left
 * or right after the split
 * @returns {number} The parentOffset if the cursor was between the two text
 *          node parts after the split.
 */
export function splitTextNode(textNode, offset, originalNodeSide = DIRECTIONS.RIGHT) {
    let parentOffset = childNodeIndex(textNode);

    if (offset > 0) {
        parentOffset++;

        if (offset < textNode.length) {
            const left = textNode.nodeValue.substring(0, offset);
            const right = textNode.nodeValue.substring(offset);
            if (originalNodeSide === DIRECTIONS.LEFT) {
                const newTextNode = document.createTextNode(right);
                textNode.after(newTextNode);
                textNode.nodeValue = left;
            } else {
                const newTextNode = document.createTextNode(left);
                textNode.before(newTextNode);
                textNode.nodeValue = right;
            }
        }
    }
    return parentOffset;
}

/**
 * Split the given element at the given offset. The element will be removed in
 * the process so caution is advised in dealing with its reference. Returns a
 * tuple containing the new elements on both sides of the split.
 *
 * @param {Element} element
 * @param {number} offset
 * @returns {[Element, Element]}
 */
export function splitElement(element, offset) {
    const before = element.cloneNode();
    const after = element.cloneNode();
    let index = 0;
    for (const child of [...element.childNodes]) {
        index < offset ? before.appendChild(child) : after.appendChild(child);
        index++;
    }
    element.before(before);
    element.after(after);
    element.remove();
    return [before, after];
}

/**
 * Split around the given elements, until a given ancestor (included). Elements
 * will be removed in the process so caution is advised in dealing with their
 * references. Returns the new split root element that is a clone of
 * limitAncestor or the original limitAncestor if no split occured.
 *
 * @see splitElement
 * @param {Node[] | Node} elements
 * @param {Node} limitAncestor
 * @returns {[Node, Node]}
 */
export function splitAroundUntil(elements, limitAncestor) {
    elements = Array.isArray(elements) ? elements : [elements];
    const firstNode = elements[0];
    const lastNode = elements[elements.length - 1];
    if ([firstNode, lastNode].includes(limitAncestor)) {
        return limitAncestor;
    }
    let before = firstNode.previousSibling;
    let after = lastNode.nextSibling;
    let beforeSplit, afterSplit;
    if (!before && !after && elements[0] !== limitAncestor) {
        return splitAroundUntil(elements[0].parentElement, limitAncestor);
    }
    // Split up ancestors up to font
    while (after && after.parentElement !== limitAncestor) {
        afterSplit = splitElement(after.parentElement, childNodeIndex(after))[0];
        after = afterSplit.nextSibling;
    }
    if (after) {
        afterSplit = splitElement(limitAncestor, childNodeIndex(after))[0];
        limitAncestor = afterSplit;
    }
    while (before && before.parentElement !== limitAncestor) {
        beforeSplit = splitElement(before.parentElement, childNodeIndex(before) + 1)[1];
        before = beforeSplit.previousSibling;
    }
    if (before) {
        beforeSplit = splitElement(limitAncestor, childNodeIndex(before) + 1)[1];
    }
    return beforeSplit || afterSplit || limitAncestor;
}

/**
 * Take a node and unwrap all of its block contents recursively. All blocks
 * (except for firstChilds) are preceded by a <br> in order to preserve the line
 * breaks.
 *
 * @param {Node} node
 */
export function makeContentsInline(node) {
    let childIndex = 0;
    for (const child of node.childNodes) {
        if (isBlock(child)) {
            if (childIndex && paragraphRelatedElements.includes(child.nodeName)) {
                child.before(document.createElement("br"));
            }
            for (const grandChild of child.childNodes) {
                child.before(grandChild);
                makeContentsInline(grandChild);
            }
            child.remove();
        }
        childIndex += 1;
    }
}

export function unwrapContents(node) {
    const contents = [...node.childNodes];
    for (const child of contents) {
        node.parentNode.insertBefore(child, node);
    }
    node.parentNode.removeChild(node);
    return contents;
}

// @todo @phoenix
// This utils seem to handle a particular case of LI element.
// If only relevant to the list plugin, a specific util should be created
// that plugin instead.
export function setTagName(el, newTagName) {
    if (el.tagName === newTagName) {
        return el;
    }
    var n = document.createElement(newTagName);
    var attr = el.attributes;
    for (var i = 0, len = attr.length; i < len; ++i) {
        n.setAttribute(attr[i].name, attr[i].value);
    }
    while (el.firstChild) {
        n.append(el.firstChild);
    }
    if (el.tagName === "LI") {
        el.append(n);
    } else {
        el.parentNode.replaceChild(n, el);
    }
    return n;
}

export function copyAttributes(source, target) {
    for (const attr of source.attributes) {
        if (attr.name === "class") {
            target.classList.add(...source.classList);
        } else {
            target.setAttribute(attr.name, attr.value);
        }
    }
}

/**
 * Removes the specified class names from the given element.  If the element has
 * no more class names after removal, the "class" attribute is removed.
 *
 * @param {Element} element - The element from which to remove the class names.
 * @param {...string} classNames - The class names to be removed.
 */
export function removeClass(element, ...classNames) {
    element.classList.remove(...classNames);
    if (!element.classList.length) {
        element.removeAttribute("class");
    }
}
