(function () {
'use strict';

var customArchNodes = we3.customArchNodes = {
    ArchNode: we3.ArchNode,
    FRAGMENT: we3.ArchNodeFragment,
    TEXT: we3.ArchNodeText,
    'TEXT-VIRTUAL': we3.ArchNodeVirtualText,
};

customArchNodes.br = class extends we3.ArchNode {
    get type () {
        return 'br';
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    addLine () {
        this.parent.addLine(this.index() + 1);
    }
    /**
     * @override
     */
    isBR () {
        return true;
    }
    /**
     * @override
     */
    isInvisibleBR () {
        if (this.isPlaceholderBR() || this.nextSibling()) {
            return false;
        }
        var prev = this.previousSibling();
        return !prev || !prev.isBR();
    }
    /**
     * @override
     */
    isPlaceholderBR () {
        return this.parent.childNodes.length === 1;
    }
    /**
     * @override
     */
    isVisibleBR () {
        return !this.isInvisibleBR();
    }
    /**
     * @override
     */
    insert (archNode) {
        if (archNode.isBR()) {
            this.params.change(archNode, archNode.length());
            this.after(archNode);
            return;
        }
        var prev = this.previousSibling();
        if (archNode.isText() && !archNode.isVirtual() &&
            (!prev || prev.isEmpty() && (!prev.isText() || prev.isVirtual()))) {
            this.params.change(archNode, archNode.length());
            this.before(archNode);
            this.remove();
            return;
        }
        this.parent.insert(archNode, this.index() + 1);
    }
    /**
     * @override
     */
    removeLeft () {
        return this._removeSide(true);
    }
    /**
     * @override
     */
    removeRight () {
        return this._removeSide(false);
    }
    /**
     * @override
     */
    split () {
        return;
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Remove the BR's first block ancestor.
     *
     * @private
     * @param {ArchNode} block
     * @returns {ArchNode|undefined} the node that will be focused after removing, if any
     */
    _removeBlockAncestor (block) {
        var options = {
            doNotInsertVirtual: function () { return true; },
        };
        var prev = block.prev(options);
        var next = block.next(options);
        var parent = block.parent;
        if (block.parent.isRoot() && block.parent.isDeepEmpty()) {
            return;
        }
        block.remove();
        return next || prev || parent;
    }
    /**
     * Remove an empty node and all its empty ancestors.
     *
     * @private
     * @param {ArchNode} node
     * @returns {ArchNode} the first non-removed ancestor, or the root.
     */
    _removeEmptyAncestors (node) {
        var parent;
        var root = node.ancestor('isRoot');
        while (node && node.isDeepEmpty() && !node.isRoot() && !node.firstLeaf().isBR()) {
            parent = node.parent;
            node.remove();
            node = parent;
        };
        return parent || root;
    }
    /**
     * Remove to the side of the BR, respecting visibility constraints.
     *
     * @private
     * @param {boolean} isLeft
     */
    _removeSide (isLeft) {
        var parent = this.parent;
        var prev = this.previousSibling() && this.previousSibling().lastLeaf();
        var next = this.nextSibling() && this.nextSibling().firstLeaf();
        if (isLeft && this.isVisibleBR() && !prev && (!next || next.isBR()) ||
            !isLeft && (!next && prev || this.isPlaceholderBR())) {
            this.params.change(isLeft || !next ? this : next, 0);
            this.deleteEdge(isLeft);
            return;
        }
        if (!prev && next && next.isVirtual() && parent.length() === 2) {
            next.remove();
            prev = parent.previousSibling();
        }
        var nextRange = {};
        if (isLeft) {
            nextRange.node = prev || next || parent;
            nextRange.offset = prev ? prev.length() : 0;
        } else {
            nextRange.node = prev && !prev.isBR() ? prev : next || parent;
            nextRange.offset = nextRange.node === prev ? prev.length() : 0;
        }
        this.params.change(nextRange.node, nextRange.offset);
        this.remove();
        parent = this._removeEmptyAncestors(parent);
        (prev || next || parent).deleteEdge(!prev, {
            doNotBreakBlocks: true,
        });
        var nextToCheck = isLeft ? prev : next;
        if (nextToCheck && !nextToCheck.__removed && nextToCheck.isInvisibleBR()) {
            nextToCheck.remove();
        }
    }
};

we3.addArchNode = function (nodeName, ArchNode) {
    customArchNodes[nodeName] = ArchNode;
};
we3.getArchNode = function (nodeName) {
    return customArchNodes[nodeName];
};


})();
