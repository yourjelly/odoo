(function () {
'use strict';

we3.ArchNodeVirtualText = class extends we3.ArchNodeText {
    constructor () {
        super(...arguments);
        this.nodeValue = '\uFEFF';
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    insert (node, offset) {
        var prev = this.previousSibling();
        if (this.parent.isEmpty() && node.isBR()) {
            var parent = this.parent;
            var index = this.index();
            this.applyRules();
            parent.insert(node, index);
            return;
        }
        if (prev) {
            prev.insert(node, prev.length());
        } else {
            this.parent.insert(node, this.index());
        }
        this.remove();
    }
    /**
     * @override
     */
    isBlankNode () { return true; }
    /**
     * @override
     */
    isBlankText () { return true; }
    /**
     * @override
     */
    isEmpty () { return true; }
    /**
     * @override
     */
    isVisibleText () { return false; }
    /**
     * @override
     */
    isVirtual () { return true; }
    length () {
        return 0;
    }
    /**
     * @override
     */
    split () { return false; }
    get type () {
        return 'TEXT-VIRTUAL';
    }

    //--------------------------------------------------------------------------
    // Public: export
    //--------------------------------------------------------------------------

    toJSON (options) {
        if (!options || !options.keepVirtual) {
            return null;
        }
        return super.toJSON(options);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _applyRulesArchNode () {
        if (this.parent && (this.parent.isList() || this.parent.isRoot())) {
            return this._mutation('br');
        }

        var flowBlock = this.ancestor('isFlowBlock');
        if (!flowBlock) {
            return this.remove();
        }

        if (flowBlock.isDeepEmpty()) {
            return this._mutation('br');
        }
    }
    _applyRulesCheckParents () {}
    _mutation (nodeName) {
        var archNode = this.params.create(nodeName);
        archNode.id = this.id;
        this.before(archNode);
        this.remove();
    }
};

})();
