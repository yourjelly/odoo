(function () {
'use strict';

we3.addArchNode('ArchitecturalSpace', class extends we3.ArchNodeText {
    insert (node, offset) {
        this.parent.insert(node, this.index());
    }
    length () {
        return 0;
    }
    toJSON (options) {
        if (this.__removed || !options || !options.architecturalSpace) {
            return null;
        }
        return {
            nodeValue: this.toString(options),
        };
    }
    toString (options) {
        var space = '';

        if (!this.__removed && options && options.architecturalSpace) {
            var indent = typeof options.architecturalSpace === 'integer' ? options.architecturalSpace : 4;

            space = '\n';

            var level = -1; // remove editable indent
            var node = this;
            while (node.parent) {
                if (!node.isVirtual() || options.keepVirtual) {
                    level++;
                }
                node = node.parent;
            }

            level -= (this.nextSibling() ? 0 : 1);

            if (level > 0) {
                space += (new Array(level * indent + 1).join(' '));
            }
        }
        return space;
    }
    get type () {
        return 'TEXT-ARCH';
    }
    /**
     * @override
     */
    isArchitecturalSpace () { return true; }
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
    split () { return false; }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _applyRulesCheckParents () {}
    _addArchitecturalSpaceNode () {
        var prev = this.previousSibling();
        if (prev && prev.isArchitecturalSpace()) {
            this.remove();
        }
    }
    _addArchitecturalSpaceNodes () {}
    /**
     * @override
     */
    _nextSibling (fn) {
        return this.nextSibling(fn);
    }
    /**
     * @override
     */
    _previousSibling (fn) {
        return this.previousSibling(fn);
    }
});

})();
