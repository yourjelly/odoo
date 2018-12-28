odoo.define('web_editor.wysiwyg.plugin.table', function (require) {
'use strict';

var Plugins = require('web_editor.wysiwyg.plugins');
var registry = require('web_editor.wysiwyg.plugin.registry');

var dom = $.summernote.dom;


var TablePlugin = Plugins.table.extend({

    initialize: function () {
        this._super.apply(this, arguments);
        setTimeout(function () {
            // contentEditable fail for image and font in table
            // user must use right arrow the number of space but without feedback
            this.$editable.find('td:has(img, span.fa)').each(function () {
                if (this.firstChild && !this.firstChild.tagName) {
                    this.firstChild.textContent = this.firstChild.textContent.replace(/^\s+/, ' ');
                }
                if (this.lastChild && !this.lastChild.tagName) {
                    this.lastChild.textContent = this.lastChild.textContent.replace(/\s+$/, ' ');
                }
            });
            this.context.invoke('HistoryPlugin.clear');
        }.bind(this));
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Insert a table.
     *
     * @param {String} dim dimension of table (ex : "5x5")
     */
    insertTable: function (dim) {
        var dimension = dim.split('x');
        var table = this.createTable(dimension[0], dimension[1], this.options);
        this.context.invoke('HelperPlugin.insertBlockNode', table);
        if (!table.previousElementSibling) {
            var p = this.document.createElement('p');
            $(p).append(this.document.createElement('br'));
            $(table).before(p);
        }
        if (!table.nextElementSibling) {
            var p = this.document.createElement('p');
            $(p).append(this.document.createElement('br'));
            $(table).after(p);
        }
        var range = this.context.invoke('editor.createRange');
        range.sc = range.ec = $(table).find('td')[0];
        range.so = range.eo = 0;
        range.normalize().select();
        this.context.invoke('editor.saveRange');
    },
    /**
     * Delete the table in range.
     */
    deleteTable: function () {
        var range = this.context.invoke('editor.createRange');
        var cell = dom.ancestor(range.commonAncestor(), dom.isCell);
        var table = $(cell).closest('table');
        var point = this.context.invoke('HelperPlugin.removeBlockNode', table);
        range.sc = range.ec = point.node;
        range.so = range.eo = point.offset;
        range.normalize().select();
    },
});

var TablePopover = Plugins.tablePopover.extend({
    events: _.defaults({
        'summernote.scroll': '_onScroll',
    }, Plugins.tablePopover.prototype.events),

    /**
     * Update the table's popover and its position.
     *
     * @override
     * @param {DOM} target
     * @returns {false|DOM} the selected cell (on which to display the popover)
     */
    update: function (target) {
        if (!target || this.context.isDisabled()) {
            return false;
        }
        var cell = dom.ancestor(target, dom.isCell);
        if (!!cell && this.options.isEditableNode(cell)) {
            var pos = $(cell).offset();
            var posContainer = $(this.options.container).offset();
            pos.left = pos.left - posContainer.left + 10;
            pos.top = pos.top - posContainer.top + $(cell).outerHeight() - 4;

            this.lastPos = {target: target, offset: $(target).offset()};

            this.$popover.css({
                display: 'block',
                left: pos.left,
                top: pos.top,
            });
        }
        else {
            this.hide();
        }
        return cell;
    },
    /**
     * Update the target table and its popover.
     *
     * @private
     * @param {SummernoteEvent} se
     * @param {JQueryEvent} e
     */
    _onScroll: function (se, e) {
        var range = this.context.invoke('editor.createRange');
        var target = dom.ancestor(range.sc, dom.isCell);
        if (!target || target === this.editable) {
            return;
        }
        if (this.lastPos && this.lastPos.target === target) {
            var newTop = $(target).offset().top;
            var movement = this.lastPos.offset.top - newTop;
            if (movement && this.mousePosition) {
                this.mousePosition.pageY -= movement;
            }
        }
        return this.update(target);
    },
});


registry.add('TablePlugin', TablePlugin);
registry.add('TablePopover', TablePopover);
registry.add('tablePopover', null);

return TablePlugin;

});
