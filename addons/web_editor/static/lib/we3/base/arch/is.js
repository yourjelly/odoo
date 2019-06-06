(function () {
'use strict';

var tags = we3.tags;
function True () { return true; };
function False () { return false; };

// is type methods

var isType = {
    /**
     * Return true if the given node is an anchor element (A, BUTTON, .btn).
     *
     * @returns {Boolean}
     */
    isAnchor: function () {
        return (
                this.nodeName === 'a' ||
                this.nodeName === 'button' ||
                this.className && this.className.contains('btn')
            ) &&
            !this.className.contains('fa') &&
            !this.className.contains('o_image');
    },
    /**
     * Return true if the node is an architectural space node.
     *
     * @returns {Boolean}
     */
    isArchitecturalSpace: False,
    /**
     * Returns true if the node is a text node containing nothing
     *
     * @returns {Boolean}
     */
    isBlankText: False,
    /**
     * Returns true if the node is blank.
     * In this context, a blank node is understood as
     * a node expecting text contents (or with children expecting text contents)
     * but without any.
     * If a predicate function is included, the node is NOT blank if it matches it.
     *
     * @param {Function (Node) => Boolean} [isNotBlank]
     * @returns {Boolean}
     */
    isBlankNode: function (isNotBlank) {
        if (this.isVoid() || isNotBlank && isNotBlank(node)) {
            return false;
        }
        if (this.isBlankText()) {
            return true;
        }
        var isBlankNode = true;
        for (var k = 0; k < this.childNodes.length; k++) {
            if (!this.childNodes[k].isBlankNode(isNotBlank)) {
                isBlankNode = false;
                break;
            }
        }
        return isBlankNode;
    },
    /**
     * Return true if the given node is a block.
     *
     * @returns {Boolean}
     */
    isBlock: function () {
        return !this.isInline();
    },
    /**
     * Return true if the given node is a block quote element (BLOCKQUOTE).
     *
     * @returns {Boolean}
     */
    isBlockquote: function () {
        return this.nodeName === 'blockquote';
    },
    /**
     * Return true if the given node is a line break element (BR).
     *
     * @returns {Boolean}
     */
    isBR: False,
    /**
     * Return true if the given node is a table cell element (TD, TH).
     *
     * @returns {Boolean}
     */
    isCell: function () {
        return this.nodeName === 'td' || this.nodeName === 'th';
    },
    isClone: False,
    /**
     * Return true if the given node is a data element (DATA).
     *
     * @returns {Boolean}
     */
    isData: function () {
        return this.nodeName === 'data';
    },
    /**
     * Return true if the given node's type is element (1).
     *
     * @returns {Boolean}
     */
    isElement: True,
    /**
     * Return true if the node is a flow content.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Content_categories#Flow_content
     * @returns {Boolean}
     */
    isFlowContent: function () {
        if (tags.flowContent.indexOf(this.nodeName) !== -1 || this.isText()) {
            return true;
        }
        var isAreaInMap = this.nodeName === 'area' && this.isInTag('map');
        var isLinkOrMetaWithItemProp = ['link', 'meta'].indexOf(this.nodeName) !== -1 && this.attributes.contains('itemprop');
        var isStyleWithScoped = this.nodeName === 'style' && this.attributes.contains('scoped');
        return isAreaInMap || isLinkOrMetaWithItemProp || isStyleWithScoped;
    },
    /**
     * Return true if the node is a block that can contain text.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Content_categories#Flow_content
     * @returns {Boolean}
     */
    isFlowBlock: function () {
        return this.isBlock() && !this.isVoidoid() && this.isFlowContent();
    },
    isFragment: False,
    /**
     * Returns true if the node is a "format" node.
     * In this context, a "format" node is understood as
     * an editable block or an editable element expecting text
     * (eg.: p, h1, span).
     *
     * @returns {Boolean}
     */
    isFormatNode: function () {
        return !this.isVoidoid() && tags.style.concat(tags.format).indexOf(this.nodeName) !== -1;
    },
    /**
     * Return true if the given node is a horizontal rule element (HR).
     *
     * @returns {Boolean}
     */
    isHr: function () {
        return this.nodeName === 'hr';
    },
    /**
     * Return true if the given node is an inline element.
     *
     * @returns {Boolean}
     */
    isInline: function () {
        return tags.inline.concat('font').indexOf(this.nodeName) !== -1;
         // &&
         //    !this.isCell() &&
         //    !this.isEditable() &&
         //    !this.isList() &&
         //    !this.isPre() &&
         //    !this._isHr() &&
         //    !this._isPara() &&
         //    !this._isTable() &&
         //    !this._isBlockquote() &&
         //    !this.isData();
    },
    isInlineFormatNode: function () {
        return !this.isVoidoid() && tags.format.indexOf(this.nodeName) !== -1;
    },
    isInvisibleBR: False,
    /**
     * Return true if the given node is a list item element (LI).
     *
     * @returns {Boolean}
     */
    isLi: function () {
        return this.nodeName === 'li';
    },
    /**
     * Return true if the given node is a (un-)ordered list element (UL, OL).
     *
     * @returns {Boolean}
     */
    isList: function () {
        return ['ul', 'ol'].indexOf(this.nodeName) !== -1;
    },
    /**
     * Return true if the given node is a paragraph element (DIV, P, LI, H[1-7]).
     *
     * @private
     * @returns {Boolean}
     */
    isPara: function () {
        // Chrome(v31.0), FF(v25.0.1) use DIV for paragraph
        return tags.style.concat(['div']).indexOf(this.nodeName) !== -1;
    },
    /**
     * Return true if the node is a BR that serves as a placeholder in a block for technical purposes.
     */
    isPlaceholderBR: False,
    /**
     * Return true if the given node is a preformatted text element (PRE).
     *
     * @returns {Boolean}
     */
    isPre: function () {
        return this.nodeName === 'pre';
    },
    /**
     * Return true if the current node is the root node.
     */
    isRoot: False,
    /**
     * Return true if the given node is a span element (SPAN).
     *
     * @returns {Boolean}
     */
    isSpan: function () {
        return this.nodeName === 'span';
    },
    /**
     * Return true if the given node is a table element (TABLE).
     *
     * @private
     * @returns {Boolean}
     */
    isTable: function () {
        return this.nodeName === 'table';
    },
    /**
     * Return true if the given node's type is text (3).
     *
     * @returns {Boolean}
     */
    isText: False,
    /**
     * Return true if the given node is a text area element (TEXTAREA).
     *
     * @private
     * @returns {Boolean}
     */
    isTextarea: function () {
        return this.nodeName === 'textarea';
    },
    isTrue: True,
    /**
     *
     * @returns {Boolean}
     */
    isVirtual: False,
    isVisibleBR: False,
    /**
     * Returns true if the node is a text node with visible text.
     *
     * @returns {Boolean}
     */
    isVisibleText: False,
    /**
     * Return true if the given node is a void element (BR, COL, EMBED, HR, IMG, INPUT, ...).
     *
     * @see http://w3c.github.io/html/syntax.html#void-elements
     * @returns {Boolean}
     */
    isVoid: function () {
        return tags.void.indexOf(this.nodeName) !== -1;
    },
    isVoidoid: function () {
        return (!this.isBR() && this.isVoid()) || this.params.isVoidoid(this);
    },
};
Object.assign(we3.ArchNode.prototype, isType);

// is in methods (for all is type methods)

var isInType = {
    /**
     * Return true if the given node is contained within a node of given tag name.
     *
     * @param {Boolean} tag eg: 'B', 'I', 'U'
     * @returns {Boolean}
     */
    isInTag: function (tag) {
        return !!this.ancestor(function (n) {
            return n.nodeName === tag;
        });
    },
    isInArch: function () {
        return this.isRoot() || !!this.parent && !!this.id && !this.__removed;
    },
};
Object.keys(isType).forEach(function (type) {
    isInType['isIn' + type.slice(2)] = function () {
        return !!this.ancestor(type);
    };
});
Object.assign(we3.ArchNode.prototype, isInType);

// is browse methods

var isBrowse = {
    /**
     * Return true if the node has no visible content.
     */
    isDeepEmpty: function () {
        if (!this.childNodes || !this.childNodes.length) {
            return this.isEmpty() || this.isPlaceholderBR();
        }
        return this.childNodes.every(function (child) {
            var isNotBlockBlock = !child.isBlock() || child.parent.isList() || child.parent.isLi();
            return isNotBlockBlock && (!child.isVisibleBR() || child.isPlaceholderBR()) && child.isDeepEmpty();
        });
    },
    /**
     * Return true if `node` is a descendent of `ancestor` (or is `ancestor` itself).
     *
     * @param {ArchNode} ancestor
     * @returns {Boolean}
     */
    isDescendentOf: function (ancestor) {
        var node = this;
        while (node) {
            if (node === ancestor) {
                return true;
            }
            node = node.parent;
        }
        return false;
    },
    /**
     * Return true if the given node is empty.
     *
     * @returns {Boolean}
     */
    isEmpty: function () {
        if (this.childNodes.length === 0) {
            return true;
        }
        var child = this.childNodes[0];
        if (this.childNodes.length === 1 && (child.isBR() || child.isText() && child.isEmpty())) {
            return true;
        }
        if (this.isFilledWithOnlyBlank()) {
            return true;
        }
        return false;
    },
    isFilledWithOnlyBlank: function () {
        return this.childNodes.every(function (child) {
            return child.isVirtual() || child.isArchitecturalSpace() || child.isBlankText();
        });
    },
    /**
     * Return true if the given node is on a left edge (ignoring invisible text).
     *
     * @param {Boolean} [ignoreVirtual] true to ignore virtual text nodes
     * @returns {Boolean}
     */
    isLeftEdge: function (ignoreVirtual) {
        if (!this.parent) {
            return false;
        }
        var previousSibling = this.parent.childNodes.slice(0, this.index());
        while (previousSibling.length && 
            (previousSibling[0].isArchitecturalSpace() ||
                ignoreVirtual && previousSibling[0].isVirtual())) {
            previousSibling.pop();
        }
        return !previousSibling.length;
    },
    /**
     * Return true if the given node is the left-most node of given ancestor.
     *
     * @param {Node} ancestor
     * @param {Boolean} [ignoreVirtual] true to ignore virtual text nodes
     * @returns {Boolean}
     */
    isLeftEdgeOf: function (ancestor, ignoreVirtual) {
        var node = this;
        while (node && node !== ancestor) {
            if (!node.isLeftEdge(ignoreVirtual)) {
                return false;
            }
            node = node.parent;
        }
        return true;
    },
    isLeftEdgeOfBlock: function (ignoreVirtual) {
        var node = this;
        while (node && !node.isBlock()) {
            if (!node.isLeftEdge(ignoreVirtual)) {
                return false;
            }
            node = node.parent;
        }
        return true;
    },
    isParentOfIndentedList: function () {
        return this.isLi() && this.firstChild().isList();
    },
    /**
     * Return true if the given node is on a right edge (ignoring invisible text).
     *
     * @param {Boolean} [ignoreVirtual] true to ignore virtual text nodes
     * @returns {Boolean}
     */
    isRightEdge: function (ignoreVirtual) {
        if (!this.parent) {
            return false;
        }
        var nextSibling = this.parent.childNodes.slice(this.index() + 1);
        while (nextSibling.length &&
            (nextSibling[0].isArchitecturalSpace() ||
                ignoreVirtual && nextSibling[0].isVirtual())) {
            nextSibling.pop();
        }
        return !nextSibling.length;
    },
    /**
     * Return true if the given node is the right-most node of given ancestor.
     *
     * @param {Node} ancestor
     * @param {Boolean} [ignoreVirtual] true to ignore virtual text nodes
     * @returns {Boolean}
     */
    isRightEdgeOf: function (ancestor, ignoreVirtual) {
        var node = this;
        while (node && node !== ancestor) {
            if (!node.isRightEdge(ignoreVirtual)) {
                return false;
            }
            node = node.parent;
        }
        return true;
    },
    isRightEdgeOfBlock: function (ignoreVirtual) {
        var node = this;
        while (node && !node.isBlock()) {
            if (!node.isRightEdge(ignoreVirtual)) {
                return false;
            }
            node = node.parent;
        }
        return true;
    },
};
Object.assign(we3.ArchNode.prototype, isBrowse);

// is editable & unbreakable methods

var isEditable = {
    isAllowUpdate: function () {
        return this.params.isBypassUpdateConstraintsActive() || !this.isInArch() || this.isEditable();
    },
    isContentEditable: function () {
        return this.attributes && this.attributes.contentEditable === 'true' || this.params.isEditableNode(this);
    },
    isEditable: function () {
        if (!this.parent) { // the node is out of the Arch
            return true;
        }
        if (this.attributes && this.attributes.contentEditable === 'false') {
            return false;
        }
        if (this.isContentEditable()) {
            return true;
        }
        return this.parent.isEditable();
    },
    /**
     * Returns true if the node is a block.
     *
     * @returns {Boolean}
     */
    isNodeBlockType: function () {
        console.warn('todo');
        return false;
        var display = window.getComputedStyle(node).display;
        // All inline elements have the word 'inline' in their display value, except 'contents'
        return display.indexOf('inline') === -1 && display !== 'contents';
    },
    isUnbreakable: function () {
        return ["td", "tr", "tbody", "tfoot", "thead", "table"].indexOf(this.nodeName) !== -1 ||
            this.isVoidoid() ||
            this.isContentEditable() ||
            this.params.isUnbreakableNode(this) ||
            !this.isAllowUpdate();
    },
}
Object.assign(we3.ArchNode.prototype, isEditable);

// is not for all previous methods

var isNotType = {};
Object.keys(we3.ArchNode.prototype).forEach(function (type) {
    isNotType['isNot' + type.slice(2)] = function () {
        return !this[type].apply(this, arguments);
    };
});
Object.assign(we3.ArchNode.prototype, isNotType);

})();
