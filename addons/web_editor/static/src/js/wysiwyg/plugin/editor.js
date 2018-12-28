odoo.define('web_editor.wysiwyg.plugin.editor', function (require) {
'use strict';

var Plugins = require('web_editor.wysiwyg.plugins');
var registry = require('web_editor.wysiwyg.plugin.registry');
var TablePlugin = require('web_editor.wysiwyg.plugin.table');

var dom = $.summernote.dom;


var NewSummernoteEditor = Plugins.editor.extend({
    //--------------------------------------------------------------------------
    // Public summernote module API
    //--------------------------------------------------------------------------

    initialize: function () {
        var self = this;
        this.history = this.context.modules.HistoryPlugin;
        this.dropzone = this.context.modules.DropzonePlugin;

        this.insertTable = this.wrapCommand(this._insertTable.bind(this));
        this.insertOrderedList = this.wrapCommand(this._insertOrderedList.bind(this));
        this.insertUnorderedList = this.wrapCommand(this._insertUnorderedList.bind(this));
        this.insertCheckList = this.wrapCommand(this._insertCheckList.bind(this));
        this.indent = this.wrapCommand(this._indent.bind(this));
        this.outdent = this.wrapCommand(this._outdent.bind(this));
        this.table = new TablePlugin(this.context);
        this.hasFocus = this._hasFocus.bind(this);

        function command (wCmd, sCmd) {
            self[sCmd || wCmd] = self.wrapCommand(function (value) {
                this.context.invoke('TextPlugin.' + wCmd, sCmd || value, value);
            });
        }
        command('formatBlock');
        command('removeFormat');
        _.each('bold,italic,underline,strikethrough,superscript,subscript'.split(','), function (sCmd) {
            command('formatText', sCmd);
        });
        _.each('justifyLeft,justifyCenter,justifyRight,justifyFull'.split(','), function (sCmd) {
            command('formatBlockStyle', sCmd);
        });

        this._super();
    },
    /**
     * Fix range issues with Firefox: rerange to harmonize.
     */
    firefoxRerange: function () {
        var range;
        if ($.browser.mozilla) {
            this.editable.normalize();
            range = this.createRange();
            var point = range.getStartPoint();
            var isCollapsed = range.isCollapsed();
            var reRange = false;

            if (isCollapsed && range.sc.parentNode.innerHTML === '\u200B') {
                return range;
            }

            var move = 0;
            var next = _.clone(point);
            while ((dom.isRightEdgePoint(next) || next.offset > dom.nodeLength(next.node)) &&
                    next.node.parentNode &&
                    next.node !== this.editable &&
                    !dom.isMedia(next.node) &&
                    (!next.node.nextSibling || !dom.isMedia(next.node.nextSibling)) &&
                    !this.context.invoke('HelperPlugin.isNodeBlockType', next.node)) {
                move = 1;
                next.offset = _.indexOf(next.node.parentNode.childNodes, next.node) + 1;
                next.node = next.node.parentNode;
            }

            if (move &&
                    (dom.isRightEdgePoint(point) || point.offset > dom.nodeLength(point.node)) &&
                    !dom.isRightEdgePoint(next) && next.offset <= dom.nodeLength(next.node)) {
                next = dom.nextPoint(next);
                next = this.context.invoke('HelperPlugin.firstLeaf', next.node.childNodes[next.offset] || next.node);
                if (next) {
                    move = 2;
                    point.node = next;
                    point.offset = 0;
                }
            }

            if (move === 2 && point.node.parentNode) {
                range.sc = point.node;
                range.so = point.offset;
                if (isCollapsed) {
                    range.ec = range.sc;
                    range.eo = range.so;
                }
                reRange = true;
            }
            if (point.node.tagName) {
                if (isCollapsed && !range.sc.childNodes[range.so] && range.sc.childNodes[range.so - 1] && range.sc.childNodes[range.so - 1].tagName === "BR") {
                    range.sc = range.ec = range.sc.childNodes[range.so - 1];
                    range.eo = range.so = 0;
                    reRange = true;
                }
                if (isCollapsed && range.sc.childNodes[range.so]) {
                    range.sc = range.ec = range.sc.childNodes[range.so];
                    range.eo = range.so = 0;
                    reRange = true;
                }
                if (range.sc.tagName === "BR") {
                    range.so = _.indexOf(range.sc.parentNode.childNodes, range.sc);
                    range.sc = range.ec = range.sc.parentNode;
                    range.eo = range.so + 1;
                    reRange = true;
                }
                // maybe also check if is text who contains last char \u200B
            }

            if (reRange) {
                range.select();
            }
        }
        return range;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Hide all popovers.
     */
    hidePopover: function () {
        this.context.invoke('MediaPlugin.hidePopovers');
        this.context.invoke('LinkPopover.hide');
    },
    /*
     * Focus the editor.
     */
    focus: function () {
        // [workaround] Screen will move when page is scolled in IE.
        //  - do focus when not focused
        if (!this.hasFocus()) {
            var range = $.summernote.range.create();
            if (range) {
                $(range.sc).closest('[contenteditable]').focus();
                range.select();
            } else {
                this.$editable.focus();
            }
        }
    },
    /**
     * Fix double-undo (CTRL-Z) issue with Odoo integration.
     *
     * @override
     */
    undo: function () {
        this.createRange();
        this._super();
    },
    /**
     * Unlink
     */
    unlink: function () {
        this.beforeCommand();
        this.context.invoke('LinkPlugin.unlink');
        this.afterCommand();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Returns true if editable area has focus.
     *
     * @private
     * @returns {Boolean}
     */
    _hasFocus: function () {
        return this.$editable.is(':focus') || !!this.$editable.find('[contenteditable]:focus').length;
    },
    /**
     * Indent a list or a format node.
     *
     * @private
     * @returns {false|Node[]} contents of list/indented item
     */
    _indent: function () {
        return this.context.invoke('BulletPlugin.indent');
    },
    /**
     * Insert a checklist.
     *
     * @private
     */
    _insertCheckList: function () {
        this.context.invoke('BulletPlugin.insertList', 'checklist');
    },
    /**
     * Insert an ordered list.
     *
     * @private
     */
    _insertOrderedList: function () {
        this.context.invoke('BulletPlugin.insertList', 'ol');
    },
    /**
     * Insert table (respecting unbreakable node rules).
     *
     * @private
     * @param {string} dim (eg: 3x3)
     */
    _insertTable: function (dim) {
        this.context.invoke('TablePlugin.insertTable', dim);
    },
    /**
     * Insert an ordered list.
     *
     * @private
     */
    _insertUnorderedList: function () {
        this.context.invoke('BulletPlugin.insertList', 'ul');
    },
    /**
     * Outdent a list or a format node.
     *
     * @private
     * @returns {false|Node[]} contents of list/outdented item
     */
    _outdent: function () {
        return this.context.invoke('BulletPlugin.outdent');
    },
});

// Override Summernote default editor
registry.add('editor', NewSummernoteEditor);

return NewSummernoteEditor;

});
