odoo.define('web_editor.wysiwyg.block_option.LayoutColumn', function (require) {
'use strict';

var LayoutColumnOption = class extends (we3.getPlugin('BlockOption:default')) {

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Changes the number of columns.
     *
     * @see this.selectClass for parameters
     */
    selectCount(target, state, previewMode, value, ui, opt) {
        this._updateColumnCount(target, value - target.children.length);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Resizes the columns so that they are kept on one row.
     *
     * @private
     */
    _resizeColumns(target) {
        var self = this;
        var columns = [].slice.call(target.children);
        var colsLength = columns.length;
        var colSize = Math.floor(12 / colsLength) || 1;
        var colOffset = Math.floor((12 - colSize * colsLength) / 2);
        var colClass = 'col-lg-' + colSize;
        columns.forEach(function (column) {
            var className = column.className.replace(/\b(col|offset)-lg(-\d+)?\b/g, '');
            self._setAttr(column, false, 'class', className);
            self._addClass(column, false, colClass);
        });
        if (colOffset) {
            this._addClass(columns[0], false, 'offset-lg-' + colOffset);
        }
    }
    /**
     * @override
     */
    _setActive(ui, target) {
        super._setActive(...arguments);
        ui.querySelectorAll('[data-select-count]').forEach(function (el) {
            var sameNb = parseInt(el.dataset.selectCount) === target.children.length;
            el.classList.toggle('active', sameNb);
        });
    }
    /**
     * Adds new columns which are clones of the last column or removes the
     * last x columns.
     *
     * @private
     * @param {integer} count - positif to add, negative to remove
     */
    _updateColumnCount(target, count) {
        if (!count) {
            return;
        }

        if (count > 0) {
            var lastColumnElement = target.children[target.children.length - 1];
            for (var i = 0; i < count; i++) {
                var clone = lastColumnElement.cloneNode(true);
                this._insertAfter(clone, false, lastColumnElement);
            }
        } else {
            [].slice.call(target.children).slice(count).forEach(function (el) {
                // FIXME should we handle removal the same way ?
                // self.trigger_up('remove_snippet', {$snippet: $(el)});
            });
        }

        this._resizeColumns(target);
        // this.trigger_up('cover_update'); FIXME
    }
};

we3.getPlugin('CustomizeBlock').registerOptionPlugIn('layout_column', LayoutColumnOption);
});
