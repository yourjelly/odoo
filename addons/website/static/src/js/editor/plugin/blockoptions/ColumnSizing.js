odoo.define('web_editor.wysiwyg.block_option.ColumnSizing', function (require) {
'use strict';

var ColumnSizingOption = class extends (we3.getPlugin('BlockOption:OverlaySizing')) {

    /**
     * @override
     */
    onClone(target, options) {
        // Below condition is added to remove offset of target element only
        // and not its children to avoid design alteration of a container/block.
        if (options.isCurrent) {
            var _class = target.className.replace(/\s*(offset-xl-|offset-lg-)([0-9-]+)/g, '');
            target.className = _class;
        }
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _getSize(target) {
        super._getSize(...arguments);
        var rowWidth = target.parentNode.offsetWidth;
        var gridE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        var gridW = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        return {
            e: [
                gridE.map(function (v) {
                    return 'col-lg-' + v;
                }),
                gridE.map(function (v) {
                    return rowWidth / 12 * v;
                }),
                'width'
            ],
            w: [
                gridW.map(function (v) {
                    return 'offset-lg-' + v;
                }),
                gridW.map(function (v) {
                    return rowWidth / 12 * v;
                }),
                'marginLeft'
            ],
        };
    }
    /**
     * @override
     */
    _onResize(overlay, target, grid, compass, beginClass, current) {
        super._onResize(...arguments);

        if (compass === 'w') {
            // don't change the right border position when we change the offset (replace col size)
            var beginCol = Number(beginClass.match(/col-lg-([0-9]+)|$/)[1] || 0);
            var beginOffset = Number(beginClass.match(/offset-lg-([0-9-]+)|$/)[1] || beginClass.match(/offset-xl-([0-9-]+)|$/)[1] || 0);
            var offset = Number(grid.w[0][current].match(/offset-lg-([0-9-]+)|$/)[1] || 0);
            if (offset < 0) {
                offset = 0;
            }
            var colSize = beginCol - (offset - beginOffset);
            if (colSize <= 0) {
                colSize = 1;
                offset = beginOffset + beginCol - 1;
            }
            this._setAttr(target, false, 'class', target.className.replace(/\s*(offset-xl-|offset-lg-|col-lg-)([0-9-]+)/g, ''));

            this._addClass(target, false, 'col-lg-' + (colSize > 12 ? 12 : colSize));
            if (offset > 0) {
                this._addClass(target, false, 'offset-lg-' + offset);
            }
        }

        var targetStyle = window.getComputedStyle(target);
        overlay.querySelector('.w').style.width = targetStyle.marginLeft;
    }
};

we3.getPlugin('CustomizeBlock').registerOptionPlugIn('sizing_x', ColumnSizingOption);
});
