(function () {
'use strict';

var FontStylePlugin = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.dependencies = ['Arch', 'Media', 'Range', 'Text'];
        this.templatesDependencies = ['/web_editor/static/src/xml/wysiwyg_format_text.xml'];
        this.buttons = {
            template: 'wysiwyg.buttons.fontstyle',
            active: '_active',
            enabled: '_enabled',
        };
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Format a 'format' block: change its tagName (eg: p -> h1).
     *
     * @param {string} nodeName
     *       P, H1, H2, H3, H4, H5, H6, BLOCKQUOTE, PRE
     */
    formatBlock (nodeName) {
        var self = this;
        var selection = this.dependencies.Range.getSelectedNodes();
        var styleAncestors = [];
        selection.map(function (node) {
            var ancestor = node.ancestor((a) => self.options.styleTags.indexOf(a.nodeName) !== -1);
            if (ancestor && ancestor.isEditable()) {
                styleAncestors.push(ancestor.id);
            }
        });
        var changedIDs = this.dependencies.Arch.wrap(this.utils.uniq(styleAncestors), nodeName);
        return changedIDs.length ? changedIDs : false;
    }
    /**
     * (Un-)format text: make it bold, italic, ...
     *
     * @param {string} nodeName
     *       B, I, U, S, SUP, SUB
     */
    formatText (nodeName) {
        nodeName = nodeName.toLowerCase();
        var range = this.dependencies.Range.getRange();
        var selectedTextNodes = this.dependencies.Range.getSelectedNodes(node => node.isText() || node.isVoidoid());
        var changedIDs = [];
        if (selectedTextNodes.length && selectedTextNodes.every(node => node.ancestor(a => a.nodeName === nodeName))) {
            changedIDs = this.dependencies.Arch.unwrapRangeFrom(nodeName);
        } else {
            changedIDs = this.dependencies.Arch.wrapRange(nodeName);
        }
        return range.scID !== range.ecID ? range : changedIDs;
    }
    /**
     * Remove format on the current range. If the range is collapsed, remove
     * the format of the current node (`focusNode`).
     *
     * @see utils.formatTags the list of removeFormat candidates as defined by W3C
     * @param {null} value
     * @param {ClonedClass} focusNode
     */
    removeFormat (value, focusNode) {
        var range = this.dependencies.Range.getRange();
        var changedIDs = [];
        // Unwrap everything at range from the removeFormat candidates
        if (this.dependencies.Range.isCollapsed()) {
            changedIDs = this.dependencies.Arch.unwrapFrom(focusNode.id, we3.tags.format);
        } else {
            changedIDs = this.dependencies.Arch.unwrapRangeFrom(we3.tags.format);
        }
        // Remove the styles of everything at range
        var unstyledNodes = [];
        if (range.isCollapsed()) {
            unstyledNodes = this._unstyle(range.scArch);
        } else {
            unstyledNodes = this._unstyle(range.getSelectedNodes());
        }
        // Reset the range if it was across several node
        if (range.scID !== range.ecID) {
            return range;
        }
        // select the nodes of which the styles were removed
        // or the nodes that were unwrapped
        return unstyledNodes.length ? unstyledNodes : changedIDs;
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {String} buttonName
     * @param {WrappedRange} range
     * @returns {Boolean} true if the given button should be active
     */
    _active (buttonName, focusNode) {
        var formatName = buttonName.split('-')[1].toLowerCase();
        switch (buttonName.split('-', 1)[0]) {
            case 'formatBlock':
                var formatBlockAncestor = focusNode.ancestor(function (n) {
                    return n.isFormatNode();
                });
                if (!formatBlockAncestor) {
                    return buttonName === 'formatBlock-p';
                }
                return formatBlockAncestor.nodeName === formatName ||
                    formatBlockAncestor.className.contains(formatName);
            case 'formatText':
                if (formatName === 'remove') {
                    return false;
                }
                return !!focusNode.isInTag(formatName);
        }
        return false;
    }
    /**
     * @private
     * @param {String} buttonName
     * @param {Node} focusNode
     * @returns {Boolean} true if the given button should be enabled
     */
    _enabled (buttonName, focusNode) {
        return !!this.dependencies.Range.getRange().scArch.ancestor('isFormatNode');
    }
    /**
     * Remove the styles of a node or an array of nodes and
     * return the nodes that were effectively unstyled.
     *
     * @private
     * @param {ArchNode|ArchNode []} node
     * @returns {ArchNode []}
     */
    _unstyle (node) {
        var nodes = Array.isArray(node) ? node : [node];
        return nodes.filter(function (node) {
            if (node.style && node.style.length) {
                node.style.clear();
                return true;
            }
        });
    }
};

we3.addPlugin('FontStyle', FontStylePlugin);

})();
