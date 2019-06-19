(function () {
'use strict';

var customizeBlock = class extends we3.AbstractPlugin {
    /**
     *
     * @override
     *
     * @param {Object[]} params.blockSelector
     * @param {string} params.blockSelector.selector
     * @param {string} params.blockSelector.exclude
     * @param {boolean} params.blockSelector.customizeAllowNotEditable
     * @param {string} params.blockSelector.customizeType
     * @param {string} params.blockSelector.customizeTargets
     **/
    constructor (parent, params) {
        super(...arguments)
        this.dependencies = ['Range', 'Selector'];
        if (!this.options.blockSelector) {
            console.error("'customizeBlock' plugin should use 'blockSelector' options");
        }
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    start () {
        this.dependencies.Range.on('focus', this, this._onFocusNode);
        return super.start();
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     *
     * @private
     *
     * @param {DOM} deepestTarget
     *
     * @returns {Object[]} deepest to upper ArchNode who match with selector
     **/
    _getCustomizableArchNode (deepestArchNode) {
        var selected = [];
        var Selector = this.dependencies.Selector;
        var archNode = deepestArchNode;
        if (archNode) {
            while (archNode) {
                var isEditable = archNode.isEditable();

                this.options.blockSelector.forEach(function (zone) {
                    if (!zone.customizeType) {
                        return;
                    }
                    if (!isEditable && !zone.customizeAllowNotEditable) {
                        return;
                    }
                    if (Selector.is(archNode, zone.selector) && (!zone.exclude || !Selector.is(archNode, zone.exclude))) {
                        selected.push({
                            target: archNode,
                            targets: zone.customizeTargets ? Selector.search(archNode, zone.customizeTargets, {returnArchNodes: true}) : [archNode],
                            customizeType: zone.customizeType,
                        });
                    }
                });
                archNode = archNode.parent;
            }
        }
        return selected;
    }

    //--------------------------------------------------------------------------
    // Handle
    //--------------------------------------------------------------------------

    _onFocusNode (focusNode) {
        var selected = this._getCustomizableArchNode(focusNode);
        var Arch = this.dependencies.Arch;

        console.log(selected);
    }
};

we3.addPlugin('CustomizeBlock', customizeBlock);

})();
