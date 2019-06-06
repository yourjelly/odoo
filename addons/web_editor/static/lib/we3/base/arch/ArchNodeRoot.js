(function () {
'use strict';

we3.ArchNodeRoot = class extends we3.ArchNode {
    index () {
        return null;
    }
    remove () {
        throw new Error("Can not remove the root");
    }
    /**
     * Get a representation of the Arch with architectural space, node IDs and virtual nodes
     */
    repr () {
        var value = this.toString({
            showIDs: true,
            keepVirtual: true,
            architecturalSpace: true,
        }).trim();
        return value;
    }
    /**
     * @override
     */
    isContentEditable () {
        return this.params.isEditableNode(this) !== false;
    }
    isUnbreakable () {
        return true;
    }
    /**
     * @override
     */
    isElement () { return false; }
    /**
     * @override
     */
    isRoot () { return true; }
    /**
     * @override
     */
    isVirtual () { return true; }
    /**
     * @override
     */
    split (offset) {
        var virtualText = this.params.create();
        this.childNodes[offset].after(virtualText);
        return virtualText;
    }
    /**
     * @override
     */
    toString (options) {
        var string = '';
        var visibleChildren = this.visibleChildren();
        if (visibleChildren) {
            if (options && options.architecturalSpace && !this._hasArchitecturalSpace) {
                visibleChildren.forEach(function (child) {
                    child._addArchitecturalSpaceNodes();
                });
                options.noInsert = true;
            }
            this.childNodes.forEach(function (child) {
                string += child.toString(options);
            });
        }
        return string;
    }
    get type () {
        return 'EDITABLE';
    }
};

})();
