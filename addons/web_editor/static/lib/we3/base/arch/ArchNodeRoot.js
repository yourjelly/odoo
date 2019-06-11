(function () {
'use strict';

we3.ArchNodeRoot = class extends we3.ArchNode {
    get type () {
        return 'EDITABLE';
    }

    /**
     * @override
     */
    index () {
        return null;
    }
    /**
     * @override
     */
    isEditable () {
        return this.isContentEditable(this) !== false;
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
    isUnbreakable () {
        return true;
    }
    /**
     * @override
     */
    isVirtual () { return true; }
    /**
     * @override
     */
    remove () {
        throw new Error("Can not remove the root");
    }
    /**
     * @override
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
};

})();
