(function () {
'use strict';

var dropBlockSelector = class extends we3.AbstractPlugin {
    /**
     *
     * @override
     *
     * @param {Object[]} params.blockSelector
     * @param {string} params.blockSelector.selector
     * @param {string} params.blockSelector.exclude
     * @param {string} params.blockSelector.dropIn
     * @param {string} params.blockSelector.dropNear
     **/
    constructor (parent, params) {
        super(...arguments);
        this.dependencies = ['Arch', 'DropBlock', 'Selector'];
        if (!this.options.blockSelector) {
            console.error("'DropblockSelector' plugin should use 'blockSelector' options");
        }
    }

    start () {
        var promise = super.start();
        this.dependencies.DropBlock.on('dropzone', this, this._onDragAndDropNeedDropZone.bind(this));
        return promise;
    }

    //--------------------------------------------------------------------------
    // Handle
    //--------------------------------------------------------------------------

    _onDragAndDropNeedDropZone (items) {
        var Selector = this.dependencies.Selector;
        var Arch = this.dependencies.Arch;
        var blockSelector = this.options.blockSelector;

        if (!items.length) {
            var ids = we3.utils.uniq(we3.utils.flatten(blockSelector.map(function (zone) {
                return zone.dropIn || zone.dropNear ? Selector.search(zone.selector) : [];
            })));
            ids.map(function (id) {
                items.push({ target: id });
            });
        }

        var data = items.splice(0);
        data.forEach(function (item) {
            if (!item.arch) {
                if (typeof item.target === 'number') {
                    item.arch = Arch.getNode(item.target);
                } else {
                    item.arch = Arch.parse(item.target).firstChild();
                }
            }
            var dropIn = [];
            var dropNear = [];
            blockSelector.forEach(function (zone) {
                if ((zone.dropIn || zone.dropNear) && Selector.is(item.arch, zone.selector) && (!zone.exclude || !Selector.is(item.arch, zone.exclude))) {
                    if (zone.dropIn) {
                        dropIn.push(zone.dropIn);
                    }
                    if (zone.dropNear) {
                        dropNear.push(zone.dropNear);
                    }
                }
            });
            if (dropIn.length || dropNear.length) {
                items.push({
                    arch: item.arch,
                    target: item.target,
                    dropIn: makeDrop(dropIn),
                    dropNear: makeDrop(dropNear),
                })
            }
        });

        function makeDrop (dropItems) {
            return function () {
                return we3.utils.uniq(we3.utils.flatten(dropItems.map(function (drop) {
                    if (drop === 'root') {
                        return [1];
                    }
                    return Selector.search(drop);
                })));
            }
        }
    }
};

we3.addPlugin('DropBlockSelector', dropBlockSelector);

})();
