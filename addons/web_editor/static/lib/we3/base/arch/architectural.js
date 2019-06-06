(function () {
'use strict';

var we3 = window.we3;

we3.ArchNode = class extends we3.ArchNode {
    /**
     * @override
     */
    toJSON (options) {
        var self = this;
        if (options && options.architecturalSpace && !this._hasArchitecturalSpace && !options.noInsert) {
            if (!options._toJSONRootArchitectural) {
                options._toJSONRootArchitectural = this;
            }
            this.params.bypassUpdateConstraints(function () {
                self._addArchitecturalSpaceNodes();
            });
            var value = super.toJSON(options);
            if (options._toJSONRootArchitectural === this) {
                this.params.bypassUpdateConstraints(function () {
                    self.removeAllArchitecturalSpace();
                });
            }
            return value;
        }
        return super.toJSON(options);
    }
    /**
     * @override
     */
    toString (options) {
        var self = this;
        if (options && options.architecturalSpace && !this._hasArchitecturalSpace && !options.noInsert) {
            if (!options._toStringRootArchitectural) {
                options._toStringRootArchitectural = this;
            }
            this.params.bypassUpdateConstraints(function () {
                self._addArchitecturalSpaceNodes();
            });
            var value = super.toString(options);
            if (options._toStringRootArchitectural === this) {
                this.params.bypassUpdateConstraints(function () {
                    self.removeAllArchitecturalSpace();
                });
            }
            return value;
        }
        return super.toString(options);
    }
    /**
     * Remove all architectural space from the Arch.
     */
    removeAllArchitecturalSpace () {
        var toRemove = [];
        var node = this.ancestor('isRoot');
        while (node) {
            node = node.walk(false, function (next) {
                next._hasArchitecturalSpace = false;
                if (next && next.isArchitecturalSpace()) {
                    toRemove.push(next);
                }
            });
        }
        toRemove.forEach(function (node) {
            node.remove();
        });
    }

    /**
     * Add an architectural space node.
     *
     * @see https://google.github.io/styleguide/htmlcssguide.html#General_Formatting
     * @private
     */
    _addArchitecturalSpaceNode () {
        if (this.__removed || !this.parent || this.parent.isInPre() || this._hasArchitecturalSpace) {
            return;
        }

        if (this.isBlock() && (this.parent.isBlock() || this.parent.isRoot() && this.previousSibling())) {
            this.before(this.params.create('ArchitecturalSpace'));
            if (!this.nextSibling()) {
                this.after(this.params.create('ArchitecturalSpace'));
            }
            this._hasArchitecturalSpace = true;
        }
    }
    /**
     * Add architectural space nodes into this node and all its descendents.
     *
     * @private
     */
    _addArchitecturalSpaceNodes () {
        this._addArchitecturalSpaceNode();
        var visibleChildren = this.visibleChildren();
        if (visibleChildren) {
            visibleChildren.forEach(function (child) {
                child._addArchitecturalSpaceNodes();
            });
        }
    }
};

})();
