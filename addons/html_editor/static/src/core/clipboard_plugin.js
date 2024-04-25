import { Plugin } from "../plugin";
import { closestBlock, isBlock } from "../utils/blocks";
import { unwrapContents } from "../utils/dom";
import { ancestors, closestElement } from "../utils/dom_traversal";
import { parseHTML } from "../utils/html";

/**
 * @typedef { import("./selection_plugin").EditorSelection } EditorSelection
 */

const CLIPBOARD_BLACKLISTS = {
    unwrap: [".Apple-interchange-newline", "DIV"], // These elements' children will be unwrapped.
    remove: ["META", "STYLE", "SCRIPT"], // These elements will be removed along with their children.
};
export const CLIPBOARD_WHITELISTS = {
    nodes: [
        // Style
        "P",
        "H1",
        "H2",
        "H3",
        "H4",
        "H5",
        "H6",
        "BLOCKQUOTE",
        "PRE",
        // List
        "UL",
        "OL",
        "LI",
        // Inline style
        "I",
        "B",
        "U",
        "S",
        "EM",
        "FONT",
        "STRONG",
        // Table
        "TABLE",
        "THEAD",
        "TH",
        "TBODY",
        "TR",
        "TD",
        // Miscellaneous
        "IMG",
        "BR",
        "A",
        ".fa",
    ],
    classes: [
        // Media
        /^float-/,
        "d-block",
        "mx-auto",
        "img-fluid",
        "img-thumbnail",
        "rounded",
        "rounded-circle",
        "table",
        "table-bordered",
        /^padding-/,
        /^shadow/,
        // Odoo colors
        /^text-o-/,
        /^bg-o-/,
        // Odoo lists
        "o_checked",
        "o_checklist",
        "oe-nested",
        // Miscellaneous
        /^btn/,
        /^fa/,
    ],
    attributes: ["class", "href", "src", "target"],
    styledTags: ["SPAN", "B", "STRONG", "I", "S", "U", "FONT", "TD"],
};

export class ClipboardPlugin extends Plugin {
    static name = "clipboard";
    static dependencies = ["dom", "selection", "sanitize"];
    static shared = ["pasteText"];

    setup() {
        this.addDomListener(this.editable, "copy", this.onCopy);
        this.addDomListener(this.editable, "cut", this.onCut);
        this.addDomListener(this.editable, "paste", this.onPaste);
        this.addDomListener(this.editable, "drop", this.onDrop);
        this.resources["handle_paste_text"] = this.resources["handle_paste_text"] || [];
        this.resources["before_paste"] = this.resources["before_paste"] || [];
    }

    onCut(ev) {
        this.onCopy(ev);
        this.dispatch("HISTORY_STAGE_SELECTION");
        this.dispatch("DELETE_SELECTION");
        this.dispatch("ADD_STEP");
    }

    /**
     * @param {ClipboardEvent} ev
     */
    onCopy(ev) {
        ev.preventDefault();
        // @todo @phoenix maybe use the new Selection class
        this.shared.setSelection(this.shared.getEditableSelection());
        const selection = this.document.getSelection();
        const range = selection.getRangeAt(0);
        let rangeContent = range.cloneContents();
        if (!rangeContent.hasChildNodes()) {
            return;
        }
        // Repair the copied range.
        if (rangeContent.firstChild.nodeName === "LI") {
            const list = range.commonAncestorContainer.cloneNode();
            list.replaceChildren(...rangeContent.childNodes);
            rangeContent = list;
        }
        if (
            rangeContent.firstChild.nodeName === "TR" ||
            rangeContent.firstChild.nodeName === "TD"
        ) {
            // We enter this case only if selection is within single table.
            const table = closestElement(range.commonAncestorContainer, "table");
            const tableClone = table.cloneNode(true);
            // A table is considered fully selected if it is nested inside a
            // cell that is itself selected, or if all its own cells are
            // selected.
            const isTableFullySelected =
                (table.parentElement &&
                    !!closestElement(table.parentElement, "td.o_selected_td")) ||
                [...table.querySelectorAll("td")]
                    .filter((td) => closestElement(td, "table") === table)
                    .every((td) => td.classList.contains("o_selected_td"));
            if (!isTableFullySelected) {
                for (const td of tableClone.querySelectorAll("td:not(.o_selected_td)")) {
                    if (closestElement(td, "table") === tableClone) {
                        // ignore nested
                        td.remove();
                    }
                }
                const trsWithoutTd = Array.from(tableClone.querySelectorAll("tr")).filter(
                    (row) => !row.querySelector("td")
                );
                for (const tr of trsWithoutTd) {
                    if (closestElement(tr, "table") === tableClone) {
                        // ignore nested
                        tr.remove();
                    }
                }
            }
            // If it is fully selected, clone the whole table rather than
            // just its rows.
            rangeContent = tableClone;
        }
        const table = closestElement(range.startContainer, "table");
        if (rangeContent.firstChild.nodeName === "TABLE" && table) {
            // Make sure the full leading table is copied.
            rangeContent.firstChild.after(table.cloneNode(true));
            rangeContent.firstChild.remove();
        }
        if (rangeContent.lastChild.nodeName === "TABLE") {
            // Make sure the full trailing table is copied.
            rangeContent.lastChild.before(
                closestElement(range.endContainer, "table").cloneNode(true)
            );
            rangeContent.lastChild.remove();
        }

        const commonAncestorElement = closestElement(range.commonAncestorContainer);
        if (commonAncestorElement && !isBlock(rangeContent.firstChild)) {
            // Get the list of ancestor elements starting from the provided
            // commonAncestorElement up to the block-level element.
            const blockEl = closestBlock(commonAncestorElement);
            const ancestorsList = [
                commonAncestorElement,
                ...ancestors(commonAncestorElement, blockEl),
            ];
            // Wrap rangeContent with clones of their ancestors to keep the styles.
            for (const ancestor of ancestorsList) {
                const clone = ancestor.cloneNode();
                clone.append(...rangeContent.childNodes);
                rangeContent.appendChild(clone);
            }
        }
        const dataHtmlElement = this.document.createElement("data");
        dataHtmlElement.append(rangeContent);
        const odooHtml = dataHtmlElement.innerHTML;
        const odooText = selection.toString();
        ev.clipboardData.setData("text/plain", odooText);
        ev.clipboardData.setData("text/html", odooHtml);
        ev.clipboardData.setData("application/vnd.odoo.odoo-editor", odooHtml);
    }

    /**
     * Handle safe pasting of html or plain text into the editor.
     */
    onPaste(ev) {
        const selection = this.document.getSelection();
        if (!selection) {
            return;
        }
        // @phoenix @todo: handle protected content
        // if (sel.anchorNode && isProtected(sel.anchorNode)) {
        //     return;
        // }

        ev.preventDefault();

        this.dispatch("HISTORY_STAGE_SELECTION");

        this.resources["before_paste"].forEach((handler) => handler(selection));

        this.handlePasteUnsupportedHtml(selection, ev.clipboardData) ||
            this.handlePasteOdooEditorHtml(ev.clipboardData) ||
            this.handlePasteHtml(selection, ev.clipboardData) ||
            this.handlePasteText(selection, ev.clipboardData);

        this.dispatch("ADD_STEP");
    }
    /**
     * @param {EditorSelection} selection
     * @param {DataTransfer} clipboardData
     */
    handlePasteUnsupportedHtml(selection, clipboardData) {
        const targetSupportsHtmlContent = isHtmlContentSupported(selection.anchorNode);
        if (!targetSupportsHtmlContent) {
            const text = clipboardData.getData("text/plain");
            this.shared.domInsert(text);
            return true;
        }
    }
    /**
     * @param {DataTransfer} clipboardData
     */
    handlePasteOdooEditorHtml(clipboardData) {
        const odooEditorHtml = clipboardData.getData("application/vnd.odoo.odoo-editor");
        if (odooEditorHtml) {
            const fragment = parseHTML(this.document, odooEditorHtml);
            this.shared.sanitize(fragment, { IN_PLACE: true });
            if (fragment.hasChildNodes()) {
                this.shared.domInsert(fragment);
            }
            return true;
        }
    }
    /**
     * @param {EditorSelection} selection
     * @param {DataTransfer} clipboardData
     */
    handlePasteHtml(selection, clipboardData) {
        const files = getImageFiles(clipboardData);
        const clipboardHtml = clipboardData.getData("text/html");
        if (files.length || clipboardHtml) {
            const clipboardElem = this.prepareClipboardData(clipboardHtml);
            // @phoenix @todo: should it be handled in table plugin?
            // When copy pasting a table from the outside, a picture of the
            // table can be included in the clipboard as an image file. In that
            // particular case the html table is given a higher priority than
            // the clipboard picture.
            if (files.length && !clipboardElem.querySelector("table")) {
                // @phoenix @todo: should it be handled in image plugin?
                this.addImagesFiles(files).then((html) => {
                    this.shared.domInsert(html);
                });
            } else {
                if (closestElement(selection.anchorNode, "a")) {
                    this.shared.domInsert(clipboardElem.textContent);
                } else {
                    this.shared.domInsert(clipboardElem);
                }
            }
            return true;
        }
    }
    /**
     * @param {EditorSelection} selection
     * @param {DataTransfer} clipboardData
     */
    handlePasteText(selection, clipboardData) {
        const text = clipboardData.getData("text/plain");
        if (this.resources["handle_paste_text"].some((handler) => handler(text, selection))) {
            return;
        } else {
            this.pasteText(text);
        }
    }
    /**
     * @param {string} text
     */
    pasteText(text) {
        const textFragments = text.split(/\r?\n/);
        let textIndex = 1;
        for (const textFragment of textFragments) {
            // Replace consecutive spaces by alternating nbsp.
            const modifiedTextFragment = textFragment.replace(/( {2,})/g, (match) => {
                let alertnateValue = false;
                return match.replace(/ /g, () => {
                    alertnateValue = !alertnateValue;
                    const replaceContent = alertnateValue ? "\u00A0" : " ";
                    return replaceContent;
                });
            });
            this.shared.domInsert(modifiedTextFragment);
            if (textIndex < textFragments.length) {
                // todo: to implement
                // Break line by inserting new paragraph and
                // remove current paragraph's bottom margin.
                // const p = closestElement(selection.anchorNode, "p");
                // if (isUnbreakable(closestBlock(selection.anchorNode))) {
                //     this._applyCommand("oShiftEnter");
                // } else {
                //     this._applyCommand("oEnter");
                //     p && (p.style.marginBottom = "0px");
                // }
            }
            textIndex++;
        }
    }

    /**
     * Prepare clipboard data (text/html) for safe pasting into the editor.
     *
     * @private
     * @param {string} clipboardData
     * @returns {Element}
     */
    prepareClipboardData(clipboardData) {
        const container = this.document.createElement("fake-container");
        container.append(parseHTML(this.document, clipboardData));

        for (const tableElement of container.querySelectorAll("table")) {
            tableElement.classList.add("table", "table-bordered", "o_table");
        }

        // todo: should it be in its own plugin ?
        const progId = container.querySelector('meta[name="ProgId"]');
        if (progId && progId.content === "Excel.Sheet") {
            // Microsoft Excel keeps table style in a <style> tag with custom
            // classes. The following lines parse that style and apply it to the
            // style attribute of <td> tags with matching classes.
            const xlStylesheet = container.querySelector("style");
            const xlNodes = container.querySelectorAll("[class*=xl],[class*=font]");
            for (const xlNode of xlNodes) {
                for (const xlClass of xlNode.classList) {
                    // Regex captures a CSS rule definition for that xlClass.
                    const xlStyle = xlStylesheet.textContent
                        .match(`.${xlClass}[^{]*{(?<xlStyle>[^}]*)}`)
                        .groups.xlStyle.replace("background:", "background-color:");
                    xlNode.setAttribute("style", xlNode.style.cssText + ";" + xlStyle);
                }
            }
        }

        for (const child of [...container.childNodes]) {
            this.cleanForPaste(child);
        }
        // Force inline nodes at the root of the container into separate P
        // elements. This is a tradeoff to ensure some features that rely on
        // nodes having a parent (e.g. convert to list, title, etc.) can work
        // properly on such nodes without having to actually handle that
        // particular case in all of those functions. In fact, this case cannot
        // happen on a new document created using this editor, but will happen
        // instantly when editing a document that was created from Etherpad.
        const fragment = this.document.createDocumentFragment();
        let p = this.document.createElement("p");
        for (const child of [...container.childNodes]) {
            if (isBlock(child)) {
                if (p.childNodes.length > 0) {
                    fragment.appendChild(p);
                    p = this.document.createElement("p");
                }
                fragment.appendChild(child);
            } else {
                p.appendChild(child);
            }

            if (p.childNodes.length > 0) {
                fragment.appendChild(p);
            }
        }
        return fragment;
    }
    /**
     * Clean a node for safely pasting. Cleaning an element involves unwrapping
     * its contents if it's an illegal (blacklisted or not whitelisted) element,
     * or removing its illegal attributes and classes.
     *
     * @param {Node} node
     */
    cleanForPaste(node) {
        if (
            !this.isWhitelisted(node) ||
            this.isBlacklisted(node) ||
            // Google Docs have their html inside a B tag with custom id.
            (node.id && node.id.startsWith("docs-internal-guid"))
        ) {
            if (!node.matches || node.matches(CLIPBOARD_BLACKLISTS.remove.join(","))) {
                node.remove();
            } else {
                // Unwrap the illegal node's contents.
                for (const unwrappedNode of unwrapContents(node)) {
                    this.cleanForPaste(unwrappedNode);
                }
            }
        } else if (node.nodeType !== Node.TEXT_NODE) {
            if (node.nodeName === "TD") {
                if (node.hasAttribute("bgcolor") && !node.style["background-color"]) {
                    node.style["background-color"] = node.getAttribute("bgcolor");
                }
            } else if (node.nodeName === "FONT") {
                // FONT tags have some style information in custom attributes,
                // this maps them to the style attribute.
                if (node.hasAttribute("color") && !node.style["color"]) {
                    node.style["color"] = node.getAttribute("color");
                }
                if (node.hasAttribute("size") && !node.style["font-size"]) {
                    // FONT size uses non-standard numeric values.
                    node.style["font-size"] = +node.getAttribute("size") + 10 + "pt";
                }
            } else if (
                ["S", "U"].includes(node.nodeName) &&
                node.childNodes.length === 1 &&
                node.firstChild.nodeName === "FONT"
            ) {
                // S and U tags sometimes contain FONT tags. We prefer the
                // strike to adopt the style of the text, so we invert them.
                const fontNode = node.firstChild;
                node.before(fontNode);
                node.replaceChildren(...fontNode.childNodes);
                fontNode.appendChild(node);
            }
            // Remove all illegal attributes and classes from the node, then
            // clean its children.
            for (const attribute of [...node.attributes]) {
                // Keep allowed styles on nodes with allowed tags.
                // todo: should the whitelist be a resource?
                if (
                    CLIPBOARD_WHITELISTS.styledTags.includes(node.nodeName) &&
                    attribute.name === "style"
                ) {
                    node.removeAttribute(attribute.name);
                    if (["SPAN", "FONT"].includes(node.tagName)) {
                        for (const unwrappedNode of unwrapContents(node)) {
                            this.cleanForPaste(unwrappedNode);
                        }
                    }
                } else if (!this.isWhitelisted(attribute)) {
                    node.removeAttribute(attribute.name);
                }
            }
            for (const klass of [...node.classList]) {
                if (!this.isWhitelisted(klass)) {
                    node.classList.remove(klass);
                }
            }
            for (const child of [...node.childNodes]) {
                this.cleanForPaste(child);
            }
        }
    }
    /**
     * Return true if the given attribute, class or node is whitelisted for
     * pasting, false otherwise.
     *
     * @private
     * @param {Attr | string | Node} item
     * @returns {boolean}
     */
    isWhitelisted(item) {
        if (item instanceof Attr) {
            return CLIPBOARD_WHITELISTS.attributes.includes(item.name);
        } else if (typeof item === "string") {
            return CLIPBOARD_WHITELISTS.classes.some((okClass) =>
                okClass instanceof RegExp ? okClass.test(item) : okClass === item
            );
        } else {
            return (
                item.nodeType === Node.TEXT_NODE ||
                (item.matches && item.matches(CLIPBOARD_WHITELISTS.nodes))
            );
        }
    }
    /**
     * Return true if the given node is blacklisted for pasting, false
     * otherwise.
     *
     * @private
     * @param {Node} node
     * @returns {boolean}
     */
    isBlacklisted(node) {
        return (
            node.nodeType !== Node.TEXT_NODE &&
            node.matches([].concat(...Object.values(CLIPBOARD_BLACKLISTS)).join(","))
        );
    }

    /**
     * @param {DragEvent} ev
     */
    onDragStart(ev) {
        if (ev.target.nodeName === "IMG") {
            ev.dataTransfer.setData("text/plain", `oid:${ev.target.oid}`);
        }
    }
    /**
     * Handle safe dropping of html into the editor.
     *
     * @param {DragEvent} ev
     */
    onDrop(ev) {
        ev.preventDefault();
        if (!isHtmlContentSupported(ev.target)) {
            return;
        }
        const sel = this.document.getSelection();
        let isInEditor = false;
        let ancestor = sel.anchorNode;
        while (ancestor && !isInEditor) {
            if (ancestor === this.editable) {
                isInEditor = true;
            }
            ancestor = ancestor.parentNode;
        }
        const dataTransfer = (ev.originalEvent || ev).dataTransfer;
        const imageOidMatch = (dataTransfer.getData("text") || "").match("oid:(.*)");
        const imageOid = imageOidMatch && imageOidMatch[1];
        const image =
            imageOid &&
            [...this.editable.querySelectorAll("*")].find((node) => node.oid === imageOid);
        const fileTransferItems = getImageFiles(dataTransfer);
        const htmlTransferItem = [...dataTransfer.items].find((item) => item.type === "text/html");
        if (image || fileTransferItems.length || htmlTransferItem) {
            if (this.document.caretPositionFromPoint) {
                const range = this.document.caretPositionFromPoint(ev.clientX, ev.clientY);
                this.shared.setSelection({
                    anchorNode: range.offsetNode,
                    anchorOffset: range.offset,
                });
            } else if (this.document.caretRangeFromPoint) {
                const range = this.document.caretRangeFromPoint(ev.clientX, ev.clientY);
                this.shared.setSelection({
                    anchorNode: range.startContainer,
                    offset: range.startOffset,
                });
            }
        }
        if (image) {
            image.classList.toggle("img-fluid", true);
            const html = image.outerHTML;
            image.remove();
            this.execCommand("insert", this.prepareClipboardData(html));
        } else if (fileTransferItems.length) {
            this.addImagesFiles(fileTransferItems).then((html) => {
                this.execCommand("insert", html);
            });
        } else if (htmlTransferItem) {
            htmlTransferItem.getAsString((pastedText) => {
                this.execCommand("insert", this.prepareClipboardData(pastedText));
            });
        }
        this.historyStep();
    }
    // @phoenix @todo: move to image or image paste plugin?
    /**
     * Add images inside the editable at the current selection.
     *
     * @param {File[]} imageFiles
     */
    async addImagesFiles(imageFiles) {
        const promises = [];
        for (const imageFile of imageFiles) {
            const imageNode = this.document.createElement("img");
            imageNode.classList.add("img-fluid");
            // Mark images as having to be saved as attachments.
            if (this.options.dropImageAsAttachment) {
                imageNode.classList.add("o_b64_image_to_save");
            }
            imageNode.dataset.fileName = imageFile.name;
            promises.push(
                getImageUrl(imageFile).then((url) => {
                    imageNode.src = url;
                    return imageNode;
                })
            );
        }
        const nodes = await Promise.all(promises);
        const fragment = this.document.createDocumentFragment();
        fragment.append(...nodes);
        return fragment;
    }
}

/**
 * @param {DataTransfer} dataTransfer
 */
function getImageFiles(dataTransfer) {
    return [...dataTransfer.items]
        .filter((item) => item.kind === "file" && item.type.includes("image/"))
        .map((item) => item.getAsFile());
}
/**
 * @param {File} file
 */
function getImageUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.readAsDataURL(file);
        reader.onloadend = (e) => {
            if (reader.error) {
                return reject(reader.error);
            }
            resolve(e.target.result);
        };
    });
}

// @phoenix @todo: move to Odoo plugin?
/**
 * Returns true if the provided node can suport html content.
 *
 * @param {Node} node
 * @returns {boolean}
 */
export function isHtmlContentSupported(node) {
    return !closestElement(
        node,
        '[data-oe-model]:not([data-oe-field="arch"]):not([data-oe-type="html"]),[data-oe-translation-id]',
        true
    );
}
